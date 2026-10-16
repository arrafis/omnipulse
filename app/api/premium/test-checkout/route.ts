import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { billingTestMode, prepareSandboxCheckout } from "@/lib/billing";
export const runtime="edge";
// Dedicated service access: only the configured confirmed sandbox reader, never live billing.
export async function POST(req:Request){
 const secret=String((env as unknown as Record<string,unknown>).STRIPE_TEST_CHECKOUT_TOKEN||"");
 if(!billingTestMode()||secret.length<48||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Sandbox service access required"},{status:403});
 try{return NextResponse.json(await prepareSandboxCheckout());}
 catch(error){console.error("Sandbox checkout preparation failed",error);return NextResponse.json({error:"Sandbox checkout could not be prepared"},{status:503});}
}
