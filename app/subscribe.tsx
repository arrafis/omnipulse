"use client";
import {useEffect,useState,type FormEvent} from "react";

export default function Subscribe({enabled}:{enabled:boolean}){
 const [email,setEmail]=useState(""),[consent,setConsent]=useState(false),[premium,setPremium]=useState(false),[categories,setCategories]=useState(["AI","Tech","Markets"]),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[success,setSuccess]=useState(false);
 async function join(address:string,agreed:boolean,interested:boolean){
  if(!enabled)throw new Error("Email subscriptions are opening soon.");
  setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/subscribers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:address,consent:agreed,premiumInterest:interested,categories:interested?categories:["AI","Tech","Markets"]})});
   const data=await res.json() as {error?:string;message?:string};
   if(!res.ok)throw new Error(data.error||"Please try again.");
   setMessage(data.message||"Check your inbox to confirm your subscription.");setSuccess(true);setEmail("");setConsent(false);setPremium(false);setCategories(["AI","Tech","Markets"]);
   return {confirmationRequested:true};
  }catch(error){const text=error instanceof Error?error.message:"Please try again.";setMessage(text);setSuccess(false);throw error;}
  finally{setBusy(false);}
 }
 async function submit(event:FormEvent){event.preventDefault();try{await join(email,consent,premium);}catch{}}
 useEffect(()=>{
  if(!enabled)return;
  const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
  if(!context?.registerTool)return;
  const controller=new AbortController();
  void Promise.resolve(context.registerTool({name:"join_omnipulse_daily_digest",title:"Join OmniPulse Daily",description:"Request a daily email subscription. Requires explicit consent and sends a confirmation email.",inputSchema:{type:"object",properties:{email:{type:"string",format:"email"},consent:{type:"boolean",const:true},premiumInterest:{type:"boolean"}},required:["email","consent"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:unknown)=>{const value=input as {email?:unknown;consent?:unknown;premiumInterest?:unknown};if(typeof value?.email!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)||value.consent!==true)throw new Error("A valid email and express consent are required.");return join(value.email,true,value.premiumInterest===true);}}, {signal:controller.signal})).catch(()=>{});
  return ()=>controller.abort();
 },[enabled]);
 return <form className="newsletter-form" onSubmit={submit}><label htmlFor="daily-email">Your email address</label><div className="newsletter-input-row"><input id="daily-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event=>setEmail(event.target.value)} required maxLength={254} disabled={!enabled||busy}/><button type="submit" disabled={!enabled||busy||!consent}>{enabled?(busy?"Requesting…":"Get the daily email ↗"):"Opening soon"}</button></div><label className="newsletter-consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={!enabled}/><span>I ask OmniPulse to send me the daily news digest by email. I can unsubscribe at any time. <a href="/privacy">Privacy details</a>.</span></label><label className="newsletter-consent"><input type="checkbox" checked={premium} onChange={event=>setPremium(event.target.checked)} disabled={!enabled}/><span>Let me know when the $7 CAD/month topic edition opens. Checking this does not charge me.</span></label>{premium&&enabled?<fieldset className="topic-choices"><legend>Topics I would follow</legend>{["AI","Tech","Markets"].map(category=><label key={category}><input type="checkbox" checked={categories.includes(category)} onChange={()=>setCategories(old=>old.includes(category)?old.length>1?old.filter(x=>x!==category):old:[...old,category])}/>{category}</label>)}</fieldset>:null}{!enabled?<p className="newsletter-status">Email delivery is being connected. No signups are being accepted yet.</p>:message?<p className="newsletter-status" role={success?"status":"alert"}>{message}</p>:null}</form>;
}
