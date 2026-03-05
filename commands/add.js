const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { dbHelper } = require('../database');

const ALLOWED_ROLE_ID = '1478444292631433450';
const TRANSACTION_CHANNEL_ID = '1478777982142251080';

const ROLE_TIERS = [
    { amount: 50000000, roleId: '1478766233221337170', name: 'Legendary Donatur' },
    { amount: 25000000, roleId: '1478766176648822814', name: 'Elite Donatur' },
    { amount: 10000000, roleId: '1478766113616560249', name: 'Exclusive Donatur' },
    { amount: 5000000, roleId: '1478766036529447086', name: 'Premium Donator' },
    { amount: 1000000, roleId: '1478765975661969469', name: 'VIP Donator' },
    { amount: 100000, roleId: '1478765880405131435', name: 'Donatur' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Tambah donasi user dan auto-update role')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User yang donasi')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('jumlah')
                .setDescription('Jumlah donasi (contoh: 50000 untuk 50rb)')
                .setRequired(true)
                .setMinValue(1000))
        .addStringOption(option => 
            option.setName('tipe_donasi')
                .setDescription('Tipe donasi')
                .setRequired(true)
                .addChoices(
                    { name: '💵 PED', value: 'PED' },
                    { name: '🚗 Kendaraan', value: 'Kendaraan' },
                    { name: '📦 Lainnya', value: 'Lainnya' }
                ))
        // WAKTU MANUAL WAJIB - HAPUS WAKTU PRESET
        .addStringOption(option => 
            option.setName('waktu_manual')
                .setDescription('Waktu donasi. Format: DD/MM/YYYY HH:MM (contoh: 05/03/2026 14:30)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('citizen_id')
                .setDescription('Citizen ID player')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('steam_link')
                .setDescription('Steam Profile Link (contoh: https://steamcommunity.com/profiles/76561198xxxx)')
                .setRequired(true)),
    
    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menggunakan command ini.',
                flags: MessageFlags.Ephemeral
            });
        }

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('jumlah');
        const tipeDonasi = interaction.options.getString('tipe_donasi');
        const waktuFinal = interaction.options.getString('waktu_manual');
        const citizenId = interaction.options.getString('citizen_id');
        const steamLink = interaction.options.getString('steam_link');
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            await dbHelper.addDonation(
                targetUser.id, 
                targetUser.username, 
                amount, 
                tipeDonasi,
                waktuFinal,
                citizenId,
                steamLink,
                interaction.user.id,
                interaction.user.username
            );
            
            const stats = await dbHelper.getUserTotal(targetUser.id);
            const total = stats.total || 0;
            
            const member = await interaction.guild.members.fetch(targetUser.id);
            let currentRole = null;
            let roleChanged = false;
            
            for (const tier of ROLE_TIERS) {
                if (total >= tier.amount) {
                    currentRole = tier;
                    break;
                }
            }
            
            if (currentRole) {
                const hasRole = member.roles.cache.has(currentRole.roleId);
                
                if (!hasRole) {
                    for (const tier of ROLE_TIERS) {
                        if (tier.roleId !== currentRole.roleId && member.roles.cache.has(tier.roleId)) {
                            await member.roles.remove(tier.roleId);
                        }
                    }
                    await member.roles.add(currentRole.roleId);
                    roleChanged = true;
                }
            }
            
            const fields = [
                { name: '👤 User Discord', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: false },
                { name: '📦 Tipe Donasi', value: `**${tipeDonasi}**`, inline: true },
                { name: '🆔 Citizen ID', value: citizenId || '-', inline: true },
                { name: '🔗 Steam Link', value: steamLink || '-', inline: true },
                { name: '⏰ Waktu Donasi', value: `**${waktuFinal}**`, inline: true },
                { name: '💰 Donasi Baru', value: `Rp ${amount.toLocaleString('id-ID')}`, inline: true },
                { name: '💵 Total Akumulasi', value: `Rp ${total.toLocaleString('id-ID')}`, inline: true },
                { name: '📊 Jumlah Transaksi', value: `${stats.count}x`, inline: true }
            ];

            if (currentRole) {
                fields.push({ name: '🎭 Role Saat Ini', value: `**${currentRole.name}**`, inline: false });
            }
            
            const embed = new EmbedBuilder()
                .setColor(roleChanged ? '#FFD700' : '#00FF00')
                .setTitle('✅ Donasi Tercatat & Role Diupdate')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(fields)
                .setFooter({ text: `Dicatat oleh: ${interaction.user.username}` })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });

            const logChannel = interaction.guild.channels.cache.get(TRANSACTION_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('📥 Transaksi Baru')
                    .addFields(
                        { name: '👤 Discord', value: `<@${targetUser.id}>`, inline: true },
                        { name: '📦 Tipe', value: tipeDonasi, inline: true },
                        { name: '🆔 Citizen ID', value: citizenId || '-', inline: true },
                        { name: '🔗 Steam', value: steamLink || '-', inline: true },
                        { name: '⏰ Waktu', value: waktuFinal, inline: true },
                        { name: '💰 Jumlah', value: `Rp ${amount.toLocaleString('id-ID')}`, inline: true },
                        { name: '💵 Total Akumulasi', value: `Rp ${total.toLocaleString('id-ID')}`, inline: true },
                        { name: '📊 Transaksi Ke', value: `${stats.count}`, inline: true },
                        { name: '🛂 Dicatat Oleh', value: interaction.user.tag, inline: true }
                    )
                    .setFooter({ text: `ID: ${targetUser.id}` })
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: '❌ Terjadi kesalahan saat menyimpan data.'
            });
        }
    }
};