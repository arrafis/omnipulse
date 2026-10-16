import { NextResponse } from "next/server";
import { applyStripeEvent, verifyStripeEvent } from "@/lib/billing";
export const runtime="edge";
export async function POST(req:Request){
 const raw=await req.text();
 if(raw.length>128000)return NextResponse.json({error:"Invalid event"},{status:400});
 const event=await verifyStripeEvent(raw,req.headers.get("stripe-signature")).catch(()=>null);
 if(!event)return NextResponse.json({error:"Invalid event signature"},{status:400});
 try{await applyStripeEvent(event);return NextResponse.json({received:true});}
 catch(error){console.error("Stripe event processing failed",error);return NextResponse.json({error:"Temporary processing failure"},{status:503});}
}
