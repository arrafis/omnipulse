import { NextResponse } from "next/server";
import { database } from "@/lib/content";
import { sameOrigin } from "@/lib/editor-auth";
import { freshToken, newsletterConfigured, sendConfirmation, sha256 } from "@/lib/newsletter";

export const runtime = "edge";
export async function POST(req: Request) {
 if (!sameOrigin(req)) return NextResponse.json({error:"Invalid request origin"},{status:403});
 if (!newsletterConfigured()) return NextResponse.json({error:"Email subscriptions are opening soon"},{status:503});
 const payload=await req.json().catch(()=>null) as {email?:unknown;consent?:unknown;premiumInterest?:unknown;categories?:unknown}|null;
 const email=typeof payload?.email==="string"?payload.email.trim().toLowerCase():"";
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||payload?.consent!==true)return NextResponse.json({error:"Enter a valid email and agree to receive the daily digest"},{status:400});
 const categories=Array.isArray(payload.categories)&&payload.categories.length>0&&payload.categories.every(x=>typeof x==="string"&&["AI","Tech","Markets"].includes(x))
  ? [...new Set(payload.categories)].join(",") : "AI,Tech,Markets";
 const db=database(),existing=await db.prepare("SELECT id,confirmed_at,confirm_sent_at FROM subscribers WHERE email=?").bind(email).first<{id:number;confirmed_at:string|null;confirm_sent_at:string|null}>();
 const generic=NextResponse.json({message:"Check your inbox for a confirmation link. If you already subscribed, no action is needed."},{status:202});
 if(existing?.confirmed_at)return generic;
 const token=freshToken(),hash=await sha256(token),now=new Date().toISOString(),expiry=new Date(Date.now()+48*3600000).toISOString();
 if(existing){
  const cutoff=new Date(Date.now()-3600000).toISOString();
  const claim=await db.prepare("UPDATE subscribers SET confirm_token_hash=?,confirm_expires_at=?,confirm_sent_at=?,premium_interest=?,preferred_categories=?,consent_at=? WHERE id=? AND confirmed_at IS NULL AND (confirm_sent_at IS NULL OR confirm_sent_at<?)").bind(hash,expiry,now,payload?.premiumInterest===true?1:0,categories,now,existing.id,cutoff).run();
  if(!claim.meta.changes)return generic;
 }else{
  const claim=await db.prepare("INSERT OR IGNORE INTO subscribers (email,token_hash,consent_at,confirm_token_hash,confirm_expires_at,confirm_sent_at,premium_interest,preferred_categories) VALUES (?,?,?,?,?,?,?,?)").bind(email,await sha256(freshToken()),now,hash,expiry,now,payload?.premiumInterest===true?1:0,categories).run();
  if(!claim.meta.changes)return generic;
 }
 try{await sendConfirmation(email,token,"confirm-"+hash.slice(0,40));}
 catch(error){
  console.error("Subscription confirmation unavailable",error);
  await db.prepare("UPDATE subscribers SET confirm_sent_at=NULL WHERE email=? AND confirm_token_hash=?").bind(email,hash).run();
  return NextResponse.json({error:"Confirmation email could not be sent. Try again shortly."},{status:503});
 }
 return generic;
}
