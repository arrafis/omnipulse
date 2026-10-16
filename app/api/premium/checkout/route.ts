import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/editor-auth";
import { preferencesSubscriber } from "@/lib/newsletter";
import { billingConfigured, createCheckout, createBillingPortal } from "@/lib/billing";
export const runtime="edge";
export async function POST(req:Request){
 if(!sameOrigin(req))return NextResponse.json({error:"Invalid request origin"},{status:403});
 if(!billingConfigured())return NextResponse.json({error:"Premium payments are opening soon"},{status:503});
 const data=await req.json().catch(()=>null) as {token?:unknown;action?:unknown}|null;
 const token=data?.token;
 if(typeof token!=="string")return NextResponse.json({error:"Open the latest edition in your email"},{status:400});
 const subscriber=await preferencesSubscriber(token);
 if(!subscriber)return NextResponse.json({error:"This link has expired. Use the link in a newer email."},{status:403});
 try{
  const url=subscriber.plan==="premium"&&subscriber.stripe_customer_id&&data?.action==="manage"
   ?await createBillingPortal(subscriber.stripe_customer_id,token)
   :subscriber.plan==="premium"?null:await createCheckout(subscriber,token);
  if(!url)return NextResponse.json({error:"Already subscribed. Use Manage billing."},{status:409});
  return NextResponse.json({url});
 }catch(error){console.error("Premium billing link failed",error);return NextResponse.json({error:"Billing is temporarily unavailable. Try again later."},{status:503});}
}
