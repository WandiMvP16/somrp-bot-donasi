const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { dbHelper } = require('../database');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const ALLOWED_ROLE_ID = '1478444292631433450';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('export')
        .setDescription('Export data donasi ke Excel')
        .addStringOption(option =>
            option.setName('periode')
                .setDescription('Filter periode')
                .setRequired(true)
                .addChoices(
                    { name: '📅 Semua Data', value: 'all' },
                    { name: '📆 Hari Ini', value: 'daily' },
                    { name: '📅 Minggu Ini', value: 'weekly' },
                    { name: '📅 Bulan Ini', value: 'monthly' }
                )),
    
    async execute(interaction) {

        // 🔒 VALIDASI ROLE
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menggunakan command ini.',
                ephemeral: true
            });
        }

        const filter = interaction.options.getString('periode');
        
        await interaction.deferReply();
        
        try {
            const data = await dbHelper.getAllDonations(filter);
            
            if (data.length === 0) {
                return interaction.editReply({ content: '❌ Tidak ada data untuk diekspor.' });
            }
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Data Donasi');
            
            worksheet.columns = [
                { header: 'No', key: 'no', width: 5 },
                { header: 'Tanggal', key: 'date', width: 20 },
                { header: 'User ID', key: 'user_id', width: 20 },
                { header: 'Username', key: 'username', width: 20 },
                { header: 'Jumlah (Rp)', key: 'amount', width: 15 },
                { header: 'Dicatat Oleh', key: 'added_by_username', width: 20 }
            ];
            
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
            
            let total = 0;
            data.forEach((row, index) => {
                worksheet.addRow({
                    no: index + 1,
                    date: new Date(row.date).toLocaleString('id-ID'),
                    user_id: row.user_id,
                    username: row.username,
                    amount: row.amount,
                    added_by_username: row.added_by_username || 'System'
                });
                total += row.amount;
            });
            
            worksheet.addRow({});
            const totalRow = worksheet.addRow({
                username: 'TOTAL',
                amount: total
            });
            totalRow.font = { bold: true };
            totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
            
            worksheet.getColumn('amount').numFmt = '#,##0';
            
            const exportsDir = path.join(__dirname, '..', 'exports');
            if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);
            
            const filename = `donasi_${filter}_${Date.now()}.xlsx`;
            const filepath = path.join(exportsDir, filename);
            
            await workbook.xlsx.writeFile(filepath);
            
            const attachment = new AttachmentBuilder(filepath, { name: filename });
            
            const periodLabels = {
                'all': 'Semua Waktu',
                'daily': 'Hari Ini',
                'weekly': 'Minggu Ini',
                'monthly': 'Bulan Ini'
            };
            
            await interaction.editReply({
                content: `✅ **Export Berhasil!**
📊 Periode: **${periodLabels[filter]}**
📄 Total Data: **${data.length} transaksi**
💰 Total Nilai: **Rp ${total.toLocaleString('id-ID')}**`,
                files: [attachment]
            });
            
            // Hapus file setelah 5 menit
            setTimeout(() => {
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
            }, 300000);
            
        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: '❌ Gagal mengekspor data.' 
            });
        }
    }
};