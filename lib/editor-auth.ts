import { database } from "./content";
const OWNER_EMAIL_SHA256="264e3fa14c23930b5f82341a617994adb911e678e8c470221c50ffa6b2185e86";

export function identity(req:Request){
 const id=req.headers.get("oai-authenticated-user-id");
 const email=req.headers.get("oai-authenticated-user-email");
 return id&&email?{id,email:email.toLowerCase()}:null;
}
export async function isOriginalOwner(email:string){
 const bytes=new TextEncoder().encode(email);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(x=>x.toString(16).padStart(2,"0")).join("");
 return hash===OWNER_EMAIL_SHA256;
}
export async function canEdit(req:Request){
 const person=identity(req);if(!person)return false;
 const row=await database().prepare("SELECT user_id FROM editors WHERE id=1").first<{user_id:string}>();
 return row?.user_id===person.id && await isOriginalOwner(person.email);
}
export async function claimEditor(req:Request){
 const person=identity(req);if(!person||!await isOriginalOwner(person.email))return false;
 await database().prepare("INSERT OR IGNORE INTO editors (id,user_id,email,claimed_at) VALUES (1,?,?,?)").bind(person.id,person.email,new Date().toISOString()).run();
 return canEdit(req);
}
export function sameOrigin(req:Request){
 const origin=req.headers.get("origin");return origin===new URL(req.url).origin;
}
