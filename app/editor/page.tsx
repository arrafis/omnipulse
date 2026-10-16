import Link from "next/link";
import {getChatGPTUser,chatGPTSignInPath} from "@/app/chatgpt-auth";
import Newsroom from "./newsroom";
export const dynamic="force-dynamic";
export default async function Editor(){const user=await getChatGPTUser();return <><div className="edition-bar"><Link href="/">OMNIPULSE</Link><span>THE NEWSROOM</span></div><main className="admin-wrap"><Link className="back-link" href="/">← Front page</Link><h1>Write and publish</h1><p>Save a draft, review its source, and publish when it is ready for readers.</p>{user?<Newsroom/>:<section className="admin-panel"><h2>Sign in to edit</h2><p>This newsroom is reserved for the site owner.</p><a className="back-link" href={chatGPTSignInPath('/editor')} target="_top">Sign in with ChatGPT →</a></section>}</main></>}
