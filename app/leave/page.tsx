import Link from "next/link";
import {LeaveForm} from "./leave-form";
export default async function Leave({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <main className="article-wrap"><Link href="/" className="back-link">← Front page</Link><h1>Leave the launch list</h1><p>If you joined with this link, you can remove your address from the list now.</p><LeaveForm token={token||""}/></main>}
