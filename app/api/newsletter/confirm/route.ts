import { NextResponse } from "next/server";
import { database } from "@/lib/content";
import { sameOrigin } from "@/lib/editor-auth";
import { sha256 } from "@/lib/newsletter";
export const runtime="edge";
export async function POST(req:Request){
 if(!sameOrigin(req))return NextResponse.json({error:"Invalid request origin"},{status:403});
 const data=await req.json().catch(()=>null) as {token?:unknown}|null;
 const token=data?.token;
 if(typeof token!=="string"||!/^[-0-9a-f]{72}$/.test(token))return NextResponse.json({error:"This confirmation link is invalid"},{status:400});
 const result=await database().prepare("UPDATE subscribers SET confirmed_at=?,confirm_token_hash=NULL,confirm_expires_at=NULL WHERE confirm_token_hash=? AND confirmed_at IS NULL AND confirm_expires_at>?").bind(new Date().toISOString(),await sha256(token),new Date().toISOString()).run();
 if(!result.meta.changes)return NextResponse.json({error:"This confirmation link expired or has already been used"},{status:410});
 return NextResponse.json({confirmed:true});
}
