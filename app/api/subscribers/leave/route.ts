import {NextResponse} from "next/server";
import {database} from "@/lib/content";
import {sameOrigin} from "@/lib/editor-auth";
export const runtime="edge";
export async function POST(req:Request){
 if(!sameOrigin(req))return NextResponse.json({error:"Invalid request origin"},{status:403});
 const data=await req.json().catch(()=>null) as {token?:unknown}|null;const token=data?.token;
 if(typeof token!=="string"||!/^[-0-9a-f]{72}$/.test(token))return NextResponse.json({error:"Invalid removal link"},{status:400});
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,"0")).join("");
 await database().prepare("DELETE FROM subscribers WHERE token_hash=?").bind(digest).run();
 return NextResponse.json({removed:true});
}
