import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Project Dossier · Hồ sơ dự án',description:'Không gian cá nhân quản lý dự án, biểu mẫu và hồ sơ triển khai.'};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="vi"><body>{children}</body></html>;
}
