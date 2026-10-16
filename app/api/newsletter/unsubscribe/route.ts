import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/editor-auth";
import { unsubscribeByToken } from "@/lib/newsletter";
export const runtime="edge";
export async function POST(req:Request){
 if(!sameOrigin(req))return NextResponse.json({error:"Invalid request origin"},{status:403});
 const data=await req.json().catch(()=>null) as {token?:unknown}|null;
 if(typeof data?.token!=="string"||!await unsubscribeByToken(data.token))return NextResponse.json({error:"Invalid unsubscribe link"},{status:400});
 return NextResponse.json({unsubscribed:true});
}
