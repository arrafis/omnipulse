import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/newsletter";
export const runtime="edge";
export async function POST(req:Request){
 const token=new URL(req.url).searchParams.get("token")||"";
 if(!await unsubscribeByToken(token))return NextResponse.json({error:"Invalid unsubscribe link"},{status:400});
 return NextResponse.json({unsubscribed:true});
}
