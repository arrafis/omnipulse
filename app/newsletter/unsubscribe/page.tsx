import Link from "next/link";
import NewsletterAction from "../action";
export default async function Unsubscribe({searchParams}:{searchParams:Promise<{token?:string}>}){const params=await searchParams;return <><div className="edition-bar"><Link href="/">OMNIPULSE</Link><span>DAILY EMAIL</span></div><main className="article-wrap"><Link className="back-link" href="/">← Front page</Link><h1>Leave the daily email.</h1><p className="standfirst">Remove your address from the OmniPulse list immediately.</p><NewsletterAction token={params.token||""} action="unsubscribe"/></main></>}
