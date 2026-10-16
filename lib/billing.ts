import { env } from "cloudflare:workers";
import { database } from "./content";
import { newsletterConfigured, preferencesToken, type PreferenceSubscriber } from "./newsletter";

const setting=(key:string)=>String((env as unknown as Record<string,unknown>)[key]||"").trim();
export const billingTestMode=()=>setting("STRIPE_MODE")==="test";
export function billingConfigured(){
 const mode=setting("STRIPE_MODE"),key=setting("STRIPE_SECRET_KEY");
 return newsletterConfigured()&&(mode==="test"||mode==="live")&&new RegExp(`^(?:sk|rk)_${mode}_`).test(key)&&setting("STRIPE_PRICE_ID").startsWith("price_")&&setting("STRIPE_WEBHOOK_SECRET").startsWith("whsec_")&&(mode==="test"?!!setting("STRIPE_TEST_EMAIL"):setting("STRIPE_BILLING_ENABLED")==="true");
}
export function billingAllowed(email:string){return billingConfigured()&&(!billingTestMode()||email.toLowerCase()===setting("STRIPE_TEST_EMAIL").toLowerCase());}
export async function billingSubscriber(subscriber:PreferenceSubscriber):Promise<PreferenceSubscriber>{
 if(!billingTestMode())return subscriber;
 const row=await database().prepare("SELECT customer_id,plan FROM premium_test_state WHERE subscriber_id=?").bind(subscriber.id).first<{customer_id:string;plan:string}>();
 return {...subscriber,plan:row?.plan||"free",stripe_customer_id:row?.customer_id||null};
}
const checkoutTable=()=>billingTestMode()?"premium_test_checkout":"premium_checkout";
type Price={id:string;active:boolean;livemode:boolean;currency:string;unit_amount:number;recurring?:{interval:string;interval_count:number}|null};
type Subscription={id:string;customer:string;status:string;livemode:boolean;metadata?:Record<string,string>;items?:{data:Array<{price:{id:string}}>}};
type Session={id:string;url:string;mode:string;payment_status:string;livemode:boolean;client_reference_id:string|null;customer:string|null;subscription:string|null};
export type StripeEvent={id?:string;livemode:boolean;type:string;data:{object:Record<string,unknown>}};

async function stripe<T>(path:string,body?:URLSearchParams):Promise<T>{
 const response=await fetch(`https://api.stripe.com${path}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${setting("STRIPE_SECRET_KEY")}`,"Stripe-Version":"2026-09-30.endive",...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{})},body,signal:AbortSignal.timeout(10000)});
 const value=await response.json().catch(()=>({})) as T;
 if(!response.ok)throw new Error(`Payment service returned ${response.status}`);
 return value;
}
const correctMode=(livemode:boolean)=>typeof livemode==="boolean"&&livemode===!billingTestMode();
const eligible=(current:Subscription)=>correctMode(current.livemode)&&(current.status==="active"||current.status==="trialing")&&!!current.items?.data.some(item=>item.price.id===setting("STRIPE_PRICE_ID"));
export async function verifyPremiumPrice(){
 const price=await stripe<Price>(`/v1/prices/${encodeURIComponent(setting("STRIPE_PRICE_ID"))}`);
 if(!correctMode(price.livemode)||!price.active||price.currency!=="cad"||price.unit_amount!==700||price.recurring?.interval!=="month"||price.recurring.interval_count!==1)throw new Error("The configured price must match this environment and charge $7 CAD each month");
 return price.id;
}
export async function createCheckout(subscriber:{id:number;email:string;stripe_customer_id:string|null},token:string){
 if(!billingAllowed(subscriber.email))throw new Error("Premium checkout is not available");
 const price=await verifyPremiumPrice(),base=setting("NEWSLETTER_SITE_URL"),table=checkoutTable();
 const db=database(),now=new Date().toISOString(),hold=new Date(Date.now()+120000).toISOString();
 const claimed=await db.prepare(`INSERT INTO ${table} (subscriber_id,expires_at) VALUES (?,?) ON CONFLICT(subscriber_id) DO UPDATE SET checkout_url=NULL,session_id=NULL,expires_at=excluded.expires_at WHERE ${table}.expires_at<? RETURNING subscriber_id`).bind(subscriber.id,hold,now).first<{subscriber_id:number}>();
 if(!claimed){
  const current=await db.prepare(`SELECT checkout_url FROM ${table} WHERE subscriber_id=?`).bind(subscriber.id).first<{checkout_url:string|null}>();
  if(current?.checkout_url?.startsWith("https://checkout.stripe.com/"))return current.checkout_url;
  throw new Error("Checkout is being prepared. Try again shortly.");
 }
 try{
  const expiry=Math.floor(Date.now()/1000)+1800;
  const suffix=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>String.fromCharCode(97+n%26)).join("");
  const body=new URLSearchParams({mode:"subscription","line_items[0][price]":price,"line_items[0][quantity]":"1",client_reference_id:String(subscriber.id),success_url:`${base}/preferences?token=${encodeURIComponent(token)}&checkout=success`,cancel_url:`${base}/preferences?token=${encodeURIComponent(token)}&checkout=cancel`,"subscription_data[metadata][subscriber_id]":String(subscriber.id),"subscription_data[billing_mode][type]":"flexible","managed_payments[enabled]":"false",integration_identifier:`omnipulse_${suffix}`,expires_at:String(expiry)});
  if(setting("STRIPE_AUTOMATIC_TAX_ENABLED")==="true")body.set("automatic_tax[enabled]","true");
  body.set(subscriber.stripe_customer_id?"customer":"customer_email",subscriber.stripe_customer_id||subscriber.email);
  const session=await stripe<Session>("/v1/checkout/sessions",body);
  if(!correctMode(session.livemode)||!session.url?.startsWith("https://checkout.stripe.com/"))throw new Error("Payment service did not return a matching checkout link");
  await db.prepare(`UPDATE ${table} SET session_id=?,checkout_url=?,expires_at=? WHERE subscriber_id=?`).bind(session.id,session.url,new Date(expiry*1000).toISOString(),subscriber.id).run();
  return session.url;
 }catch(error){await db.prepare(`DELETE FROM ${table} WHERE subscriber_id=? AND session_id IS NULL`).bind(subscriber.id).run();throw error;}
}
export async function createBillingPortal(customer:string,token:string){
 if(!billingConfigured())throw new Error("Billing is not available");
 const body=new URLSearchParams({customer,return_url:`${setting("NEWSLETTER_SITE_URL")}/preferences?token=${encodeURIComponent(token)}`});
 if(setting("STRIPE_PORTAL_CONFIGURATION"))body.set("configuration",setting("STRIPE_PORTAL_CONFIGURATION"));
 const session=await stripe<{url:string}>("/v1/billing_portal/sessions",body);
 if(!session.url?.startsWith("https://billing.stripe.com/"))throw new Error("Payment service did not return a billing link");
 return session.url;
}
async function hmac(value:string,key:string){
 const imported=await crypto.subtle.importKey("raw",new TextEncoder().encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",imported,new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");
}
export async function verifyStripeEvent(raw:string,header:string|null):Promise<StripeEvent|null>{
 const fields=header?.split(",").map(x=>x.trim())||[],timestamp=fields.find(x=>x.startsWith("t="))?.slice(2),signatures=fields.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3));
 if(!timestamp||!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300||!signatures.length||!setting("STRIPE_WEBHOOK_SECRET"))return null;
 const expected=await hmac(`${timestamp}.${raw}`,setting("STRIPE_WEBHOOK_SECRET"));
 const valid=signatures.some(signature=>{if(!/^[a-f0-9]{64}$/.test(signature))return false;let difference=0;for(let i=0;i<64;i++)difference|=signature.charCodeAt(i)^expected.charCodeAt(i);return difference===0;});
 if(!valid)return null;
 const event=JSON.parse(raw) as StripeEvent;
 return typeof event.type==="string"&&event.data?.object&&correctMode(event.livemode)?event:null;
}
async function subscription(id:string){return stripe<Subscription>(`/v1/subscriptions/${encodeURIComponent(id)}`);}
export async function applyStripeEvent(event:StripeEvent){
 if(!correctMode(event.livemode))return;
 const object=event.data.object,db=database();
 if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){
  const session=object as unknown as Session,id=Number(session.client_reference_id);
  if(session.mode!=="subscription"||!Number.isSafeInteger(id)||id<1||typeof session.customer!=="string"||typeof session.subscription!=="string"||!["paid","no_payment_required"].includes(session.payment_status))return;
  const locked=await db.prepare(`SELECT session_id FROM ${checkoutTable()} WHERE subscriber_id=?`).bind(id).first<{session_id:string}>();
  if(locked?.session_id!==session.id)return;
  const current=await subscription(session.subscription);
  if(!correctMode(current.livemode)||current.customer!==session.customer||current.metadata?.subscriber_id!==String(id))return;
  const plan=eligible(current)?"premium":"free";
  if(billingTestMode()){
   await db.prepare("INSERT INTO premium_test_state (subscriber_id,customer_id,subscription_id,status,plan,updated_at) SELECT id,?,?,?,?,? FROM subscribers WHERE id=? AND confirmed_at IS NOT NULL AND email=? ON CONFLICT(subscriber_id) DO UPDATE SET customer_id=excluded.customer_id,subscription_id=excluded.subscription_id,status=excluded.status,plan=excluded.plan,updated_at=excluded.updated_at")
    .bind(session.customer,current.id,current.status,plan,new Date().toISOString(),id,setting("STRIPE_TEST_EMAIL").toLowerCase()).run();
  }else{
   await db.prepare("UPDATE subscribers SET stripe_customer_id=?,stripe_subscription_id=?,stripe_subscription_status=?,plan=? WHERE id=? AND confirmed_at IS NOT NULL AND (stripe_subscription_id IS NULL OR stripe_subscription_id=? OR stripe_subscription_status IN ('canceled','incomplete_expired'))").bind(session.customer,current.id,current.status,plan,id,current.id).run();
  }
  await db.prepare(`DELETE FROM ${checkoutTable()} WHERE subscriber_id=? AND session_id=?`).bind(id,session.id).run();
 }
 if(["customer.subscription.updated","customer.subscription.deleted","invoice.paid","invoice.payment_failed"].includes(event.type)){
  const isInvoice=event.type.startsWith("invoice.");
  const parent=object.parent as {type?:string;subscription_details?:{subscription?:string|{id?:string}}}|undefined;
  const reference=isInvoice?(parent?.type==="subscription_details"?parent.subscription_details?.subscription:object.subscription):object.id;
  const id=typeof reference==="string"?reference:reference&&typeof reference==="object"?(reference as {id?:unknown}).id:null;
  if(typeof id!=="string")return;
  const current=await subscription(id);if(!correctMode(current.livemode))return;
  if(isInvoice&&object.customer!==current.customer)return;
  const plan=eligible(current)?"premium":"free";
  if(billingTestMode())await db.prepare("UPDATE premium_test_state SET status=?,plan=?,updated_at=? WHERE subscription_id=? AND customer_id=?").bind(current.status,plan,new Date().toISOString(),current.id,current.customer).run();
  else await db.prepare("UPDATE subscribers SET stripe_subscription_status=?,plan=? WHERE stripe_subscription_id=? AND stripe_customer_id=?").bind(current.status,plan,current.id,current.customer).run();
 }
}

// Owner MCP callers may prepare only the configured, confirmed sandbox reader.
export async function prepareSandboxCheckout(){
 if(!billingTestMode()||!billingConfigured())throw new Error("Sandbox billing is not configured");
 const reader=await database().prepare("SELECT id,email,plan,preferred_categories,stripe_customer_id FROM subscribers WHERE email=? AND confirmed_at IS NOT NULL").bind(setting("STRIPE_TEST_EMAIL").toLowerCase()).first<PreferenceSubscriber>();
 if(!reader||!billingAllowed(reader.email))throw new Error("Confirm the configured test email first");
 const current=await billingSubscriber(reader),token=await preferencesToken(reader.id,reader.email);
 const preferences_url=`${setting("NEWSLETTER_SITE_URL")}/preferences?token=${encodeURIComponent(token)}`;
 const checkout_url=current.plan==="premium"&&current.stripe_customer_id?await createBillingPortal(current.stripe_customer_id,token):await createCheckout(current,token);
 return {mode:"test",real_charges:false,plan:current.plan,checkout_url,preferences_url};
}
