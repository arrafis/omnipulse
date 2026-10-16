import Link from "next/link";
import { preferencesSubscriber } from "@/lib/newsletter";
import { billingAllowed, billingSubscriber, billingTestMode } from "@/lib/billing";
import PreferencesForm from "./preferences-form";
export const dynamic="force-dynamic";
export default async function Preferences({searchParams}:{searchParams:Promise<{token?:string;checkout?:string}>}){
 const params=await searchParams,token=params.token||"";
 const original=await preferencesSubscriber(token).catch(()=>null);
 const subscriber=original?await billingSubscriber(original):null;
 return <><div className="edition-bar"><Link href="/">OMNIPULSE</Link><span>YOUR EDITION</span></div><main className="article-wrap"><Link className="back-link" href="/">← Front page</Link><span className="kicker">YOUR MORNING READ</span><h1>Choose your topics.</h1>{subscriber?<><p className="standfirst">{subscriber.plan==="premium"?"Your Focus edition follows the topics you choose below.":"Your free edition covers AI, technology and markets. Choose the topics you would follow in a Focus edition."}</p><PreferencesForm token={token} initial={subscriber.preferred_categories.split(",")} plan={subscriber.plan} billingEnabled={billingAllowed(subscriber.email)} testMode={billingTestMode()&&billingAllowed(subscriber.email)} checkout={params.checkout}/></>:<p className="standfirst">This link is invalid or has expired. Open the latest OmniPulse email for a new link.</p>}</main></>;
}
