import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:{default:"OmniPulse | AI, tech and markets",template:"%s | OmniPulse"},description:"Fresh AI, technology and markets headlines, publisher summaries, and direct links to original reporting.",icons:{icon:"/favicon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>}
