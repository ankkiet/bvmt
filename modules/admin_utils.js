import { db, collection, getDocs } from './firebase.js';
import { Utils } from './utils.js';

// Xuất dữ liệu ra file Excel
export async function exportExcel(type) { 
    Utils.loader(true, "Đang tạo file Excel chuẩn..."); 
    // ExcelJS và saveAs được load từ CDN (Global scope)
    const workbook = new ExcelJS.Workbook(); 
    const sheet = workbook.addWorksheet('DuLieu'); 
    
    if (type === 'users') { 
        sheet.columns = [ { header: 'STT', key: 'stt', width: 6 }, { header: 'Tên người dùng', key: 'name', width: 25 }, { header: 'Ngày sinh', key: 'dob', width: 15 }, { header: 'Email', key: 'email', width: 30 }, { header: 'ID', key: 'id', width: 15 }, { header: 'Ngày đăng ký', key: 'created', width: 20 }, { header: 'Lớp', key: 'class', width: 15 }, { header: 'Hoạt động cuối', key: 'active', width: 20 }, { header: 'Số lần đăng nhập', key: 'count', width: 15 } ]; 
        const snap = await getDocs(collection(db, "users")); let i=1; snap.forEach(d => { const u = d.data(); sheet.addRow({ stt: i++, name: u.displayName || '', dob: u.dob || '', email: u.email || '', id: u.customID || '', created: u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleString('vi-VN') : '', class: u.class || '', active: u.lastActive ? new Date(u.lastActive.seconds * 1000).toLocaleString('vi-VN') : '', count: u.loginCount || 1 }); }); 
    } else { 
        sheet.columns = [ { header: 'STT', key: 'stt', width: 6 }, { header: 'Người đăng', key: 'author', width: 25 }, { header: 'ID', key: 'uid', width: 15 }, { header: 'Lớp', key: 'class', width: 10 }, { header: 'Mô tả', key: 'desc', width: 40 }, { header: 'Tim', key: 'likes', width: 10 }, { header: 'Link ảnh', key: 'url', width: 40 }, { header: 'Ngày đăng', key: 'date', width: 20 } ]; 
        const snap = await getDocs(collection(db, type)); let i=1; snap.forEach(d => { const p = d.data(); sheet.addRow({ stt: i++, author: p.authorName, uid: p.authorID || '', class: p.className || '', desc: p.desc || '', likes: p.likes ? p.likes.length : 0, url: p.url, date: p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleString('vi-VN') : '' }); }); 
    } 
    const headerRow = sheet.getRow(1); headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }; headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } }; headerRow.alignment = { vertical: 'middle', horizontal: 'center' }; headerRow.height = 30; 
    sheet.eachRow((row, rowNumber) => { row.eachCell((cell) => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; cell.alignment = { vertical: 'middle', wrapText: true }; }); }); 
    const buffer = await workbook.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); saveAs(blob, `GreenSchool_${type}_${new Date().toISOString().slice(0,10)}.xlsx`); Utils.loader(false); 
}

// Xuất dữ liệu ra file PDF
export async function exportPDF(type) {
    Utils.loader(true, "Đang tạo PDF...");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Tiêu đề
    doc.setFontSize(18);
    doc.text("BAO CAO THI DUA - GREEN SCHOOL A2K41", 14, 22);
    doc.setFontSize(11);
    doc.text(`Ngay xuat: ${new Date().toLocaleString('vi-VN')}`, 14, 30);

    // Lấy dữ liệu
    const snap = await getDocs(collection(db, type));
    let bodyData = [];
    snap.forEach(d => {
        const p = d.data();
        bodyData.push([p.className || '', p.authorName, p.desc || '', p.likes ? p.likes.length : 0, p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString('vi-VN') : '']);
    });

    // Tạo bảng
    doc.autoTable({
        head: [['Lop', 'Nguoi Dang', 'Mo Ta', 'Tim', 'Ngay']],
        body: bodyData,
        startY: 40,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [46, 125, 50] } // Màu xanh Green School
    });

    doc.save(`BaoCao_${type}_${Date.now()}.pdf`);
    Utils.loader(false);
}

// Tạo Sitemap XML (SEO)
export async function generateSitemap() {
    Utils.loader(true, "Đang tạo Sitemap XML...");

    const baseUrl = window.location.href.split('#')[0].split('?')[0]; // Lấy URL gốc (bỏ hash/query)
    const today = new Date().toISOString().split('T')[0];

    // Header chuẩn của Sitemap XML (bao gồm namespace cho Image)
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    // 1. Thêm Trang chủ
    xml += `  <url>\n    <loc>${baseUrl}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    // 2. Thêm Sitemap Hình ảnh (Quét từ Gallery & Contest)
    const cols = ['gallery', 'contest'];
    for (const col of cols) {
        const snap = await getDocs(collection(db, col));
        snap.forEach(d => {
            const data = d.data();
            if (data.url) {
                const cleanDesc = (data.desc || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
                const cleanAuthor = (data.authorName || 'Thành viên').replace(/&/g, '&amp;');
                xml += `  <url>\n    <loc>${baseUrl}#${col}</loc>\n    <image:image>\n      <image:loc>${data.url}</image:loc>\n      ${cleanDesc ? `<image:caption>${cleanDesc}</image:caption>\n` : ''}      <image:title>Ảnh đăng bởi ${cleanAuthor}</image:title>\n    </image:image>\n  </url>\n`;
            }
        });
    }
    xml += '</urlset>';
    const blob = new Blob([xml], { type: "application/xml" });
    saveAs(blob, "sitemap.xml");
    Utils.loader(false);
    alert("✅ Đã tạo xong sitemap.xml!\nHãy upload file này lên thư mục gốc (public) của hosting.");
}