import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import WorkspaceApp from '@/components/workspace-app';
export const dynamic='force-dynamic';
export default async function Home() {
 const db=await serverClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user) redirect('/login');
 if(!process.env.OWNER_EMAIL || user.email?.toLowerCase()!==process.env.OWNER_EMAIL.toLowerCase() || !user.email_confirmed_at) redirect('/login?error=access');
 return <WorkspaceApp email={user.email||''}/>;
}
