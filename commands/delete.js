const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { dbHelper } = require('../database');

const TRANSACTION_CHANNEL_ID = '1478777982142251080';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Hapus data donasi jika admin salah input (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('byid')
                .setDescription('Hapus transaksi by ID')
                .addIntegerOption(option => 
                    option.setName('id')
                        .setDescription('ID transaksi yang mau dihapus')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lihat list transaksi user untuk cari ID'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('last')
                .setDescription('Hapus transaksi terakhir user')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('User yang transaksi terakhirnya mau dihapus')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            if (subcommand === 'byid') {
                await this.deleteById(interaction);
            } else if (subcommand === 'list') {
                await this.listTransactions(interaction);
            } else if (subcommand === 'last') {
                await this.deleteLast(interaction);
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: '❌ Terjadi kesalahan saat menghapus data.' 
            });
        }
    },

    // =========================
    // DELETE BY ID
    // =========================
    async deleteById(interaction) {
        const id = interaction.options.getInteger('id');
        const transaction = await dbHelper.getTransactionById(id);

        if (!transaction) {
            return interaction.editReply({ 
                content: `❌ Transaksi dengan ID **${id}** tidak ditemukan.` 
            });
        }

        const deleted = await dbHelper.deleteTransaction(id);

        if (deleted > 0) {

            await interaction.editReply({
                content: `✅ Transaksi ID ${id} berhasil dihapus.`
            });

            // ================= LOG CHANNEL =================
            const logChannel = interaction.guild.channels.cache.get(TRANSACTION_CHANNEL_ID);

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('🗑️ Transaksi Dihapus')
                    .addFields({
                        name: '🗑️ Data Dihapus',
                        value: `🆔 ID ${id} | 👤 <@${transaction.user_id}> | 💰 Rp ${transaction.amount.toLocaleString('id-ID')} | 🛂 ${interaction.user.tag}`,
                        inline: false
                    })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }

        } else {
            await interaction.editReply({ 
                content: `❌ Gagal menghapus transaksi ID ${id}.` 
            });
        }
    },

    // =========================
    // LIST TRANSAKSI
    // =========================
    async listTransactions(interaction) {
        const allData = await dbHelper.getAllDonations('all');
        const recent = allData.slice(0, 20);

        if (recent.length === 0) {
            return interaction.editReply({ content: '❌ Belum ada data donasi.' });
        }

        let listText = '';
        recent.forEach(row => {
            const date = new Date(row.date).toLocaleDateString('id-ID');
            listText += `\`ID:${row.id}\` | ${row.username} | Rp ${row.amount.toLocaleString('id-ID')} | ${date}\n`;
        });

        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('📋 20 Transaksi Terakhir')
            .setDescription(listText)
            .setFooter({ text: 'Gunakan /delete byid id:[nomor] untuk menghapus' });

        await interaction.editReply({ embeds: [embed] });
    },

    // =========================
    // DELETE LAST
    // =========================
    async deleteLast(interaction) {
        const targetUser = interaction.options.getUser('user');
        const transactions = await dbHelper.getUserTransactions(targetUser.id);

        if (transactions.length === 0) {
            return interaction.editReply({ 
                content: `❌ ${targetUser.username} tidak punya riwayat donasi.` 
            });
        }

        const lastTransaction = transactions[0];
        const id = lastTransaction.id;

        const deleted = await dbHelper.deleteTransaction(id);

        if (deleted > 0) {

            await interaction.editReply({
                content: `✅ Transaksi terakhir ${targetUser.username} berhasil dihapus.`
            });

            // ================= LOG CHANNEL =================
            const logChannel = interaction.guild.channels.cache.get(TRANSACTION_CHANNEL_ID);

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('🗑️ Transaksi Terakhir Dihapus')
                    .addFields({
                        name: '🗑️ Data Dihapus',
                        value: `🆔 ID ${id} | 👤 <@${targetUser.id}> | 💰 Rp ${lastTransaction.amount.toLocaleString('id-ID')} | 🛂 ${interaction.user.tag}`,
                        inline: false
                    })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }

        } else {
            await interaction.editReply({ 
                content: `❌ Gagal menghapus transaksi.` 
            });
        }
    }
};