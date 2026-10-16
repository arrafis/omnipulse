import { env } from "cloudflare:workers";
import { database } from "./content";
import { newsletterConfigured } from "./newsletter";

const setting=(key:string)=>String((env as unknown as Record<string,unknown>)[key]||"").trim();
export function billingConfigured(){
 return newsletterConfigured()&&setting("STRIPE_SECRET_KEY").startsWith("sk_")&&setting("STRIPE_PRICE_ID").startsWith("price_")&&setting("STRIPE_WEBHOOK_SECRET").startsWith("whsec_");
}

type Price={id:string;active:boolean;currency:string;unit_amount:number;recurring?:{interval:string}|null};
type Subscription={id:string;customer:string;status:string;items?:{data:Array<{price:{id:string}}>}};
type Session={id:string;url:string;mode:string;client_reference_id:string|null;customer:string|null;subscription:string|null};

async function stripe<T>(path:string,body?:URLSearchParams):Promise<T>{
 const response=await fetch(`https://api.stripe.com${path}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${setting("STRIPE_SECRET_KEY")}`,...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{})},body,signal:AbortSignal.timeout(10000)});
 const value=await response.json().catch(()=>({})) as T & {error?:{message?:string}};
 if(!response.ok)throw new Error(`Payment service returned ${response.status}: ${value.error?.message||"request failed"}`);
 return value;
}

export async function verifyPremiumPrice(){
 const price=await stripe<Price>(`/v1/prices/${encodeURIComponent(setting("STRIPE_PRICE_ID"))}`);
 if(!price.active||price.currency!=="cad"||price.unit_amount!==700||price.recurring?.interval!=="month")throw new Error("The configured price must be an active $7 CAD monthly subscription");
 return price.id;
}

export async function createCheckout(subscriber:{id:number;email:string;stripe_customer_id:string|null},token:string){
 if(!billingConfigured())throw new Error("Premium checkout is not available");
 const price=await verifyPremiumPrice(),base=setting("NEWSLETTER_SITE_URL");
 const db=database(),now=new Date().toISOString(),hold=new Date(Date.now()+120000).toISOString();
 const claimed=await db.prepare("INSERT INTO premium_checkout (subscriber_id,expires_at) VALUES (?,?) ON CONFLICT(subscriber_id) DO UPDATE SET checkout_url=NULL,session_id=NULL,expires_at=excluded.expires_at WHERE premium_checkout.expires_at<? RETURNING subscriber_id").bind(subscriber.id,hold,now).first<{subscriber_id:number}>();
 if(!claimed){
  const current=await db.prepare("SELECT checkout_url FROM premium_checkout WHERE subscriber_id=?").bind(subscriber.id).first<{checkout_url:string|null}>();
  if(current?.checkout_url?.startsWith("https://checkout.stripe.com/"))return current.checkout_url;
  throw new Error("Checkout is being prepared. Try again shortly.");
 }
 try{
  const expiry=Math.floor(Date.now()/1000)+1800;
  const body=new URLSearchParams({mode:"subscription","line_items[0][price]":price,"line_items[0][quantity]":"1",client_reference_id:String(subscriber.id),success_url:`${base}/preferences?token=${encodeURIComponent(token)}&checkout=success`,cancel_url:`${base}/preferences?token=${encodeURIComponent(token)}&checkout=cancel`,"subscription_data[metadata][subscriber_id]":String(subscriber.id),"automatic_tax[enabled]":"true",billing_address_collection:"required",expires_at:String(expiry)});
  body.set(subscriber.stripe_customer_id?"customer":"customer_email",subscriber.stripe_customer_id||subscriber.email);
  const session=await stripe<Session>("/v1/checkout/sessions",body);
  if(!session.url?.startsWith("https://checkout.stripe.com/"))throw new Error("Payment service did not return a checkout link");
  await db.prepare("UPDATE premium_checkout SET session_id=?,checkout_url=?,expires_at=? WHERE subscriber_id=?").bind(session.id,session.url,new Date(expiry*1000).toISOString(),subscriber.id).run();
  return session.url;
 }catch(error){await db.prepare("DELETE FROM premium_checkout WHERE subscriber_id=? AND session_id IS NULL").bind(subscriber.id).run();throw error;}
}

export async function createBillingPortal(customer:string,token:string){
 if(!billingConfigured())throw new Error("Billing is not available");
 const session=await stripe<{url:string}>("/v1/billing_portal/sessions",new URLSearchParams({customer,return_url:`${setting("NEWSLETTER_SITE_URL")}/preferences?token=${encodeURIComponent(token)}`}));
 if(!session.url?.startsWith("https://billing.stripe.com/"))throw new Error("Payment service did not return a billing link");
 return session.url;
}

async function hmac(value:string,key:string){
 const imported=await crypto.subtle.importKey("raw",new TextEncoder().encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",imported,new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");
}
export async function verifyStripeEvent(raw:string,header:string|null):Promise<{type:string;data:{object:Record<string,unknown>}}|null>{
 const fields=header?.split(",").map(x=>x.trim())||[],timestamp=fields.find(x=>x.startsWith("t="))?.slice(2),signatures=fields.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3));
 if(!timestamp||!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300||!signatures.length||!setting("STRIPE_WEBHOOK_SECRET"))return null;
 const expected=await hmac(`${timestamp}.${raw}`,setting("STRIPE_WEBHOOK_SECRET"));
 // The signature is lowercase hex. Checking every character avoids an early-exit comparison.
 const valid=signatures.some(signature=>{
  if(!/^[a-f0-9]{64}$/.test(signature))return false;
  let difference=0;for(let i=0;i<64;i++)difference|=signature.charCodeAt(i)^expected.charCodeAt(i);return difference===0;
 });
 if(!valid)return null;
 const event=JSON.parse(raw) as {type?:unknown;data?:{object?:Record<string,unknown>}};
 return typeof event.type==="string"&&event.data?.object?event as {type:string;data:{object:Record<string,unknown>}}:null;
}

const isPaid=(status:string)=>status==="active"||status==="trialing";
async function subscription(id:string){return stripe<Subscription>(`/v1/subscriptions/${encodeURIComponent(id)}`);}
export async function applyStripeEvent(event:{type:string;data:{object:Record<string,unknown>}}){
 const object=event.data.object,db=database();
 if(event.type==="checkout.session.completed"){
  const session=object as unknown as Session;
  const id=Number(session.client_reference_id);
  if(session.mode!=="subscription"||!Number.isSafeInteger(id)||id<1||typeof session.customer!=="string"||typeof session.subscription!=="string")return;
  const current=await subscription(session.subscription);
  if(current.customer!==session.customer||!current.items?.data.some(item=>item.price.id===setting("STRIPE_PRICE_ID")))return;
  await db.prepare("UPDATE subscribers SET stripe_customer_id=?,stripe_subscription_id=?,stripe_subscription_status=?,plan=? WHERE id=? AND confirmed_at IS NOT NULL AND (stripe_subscription_id IS NULL OR stripe_subscription_id=?)")
   .bind(session.customer,current.id,current.status,isPaid(current.status)?"premium":"free",id,current.id).run();
  await db.prepare("DELETE FROM premium_checkout WHERE subscriber_id=? AND session_id=?").bind(id,session.id).run();
 }
 if(event.type==="customer.subscription.updated"||event.type==="customer.subscription.deleted"){
  const id=object.id;
  if(typeof id!=="string")return;
  const current=await subscription(id);
  await db.prepare("UPDATE subscribers SET stripe_subscription_status=?,plan=? WHERE stripe_subscription_id=? AND stripe_customer_id=?")
   .bind(current.status,isPaid(current.status)?"premium":"free",id,current.customer).run();
 }
}
