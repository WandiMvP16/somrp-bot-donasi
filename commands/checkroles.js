const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { dbHelper } = require('../database');

// ROLE TIERS - SAMA PERSIS DENGAN ADD.JS
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
        .setName('checkroles')
        .setDescription('Cek status donasi dan role user (Hanya info, tidak mengubah role)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User yang dicek (kosong = semua user)')
                .setRequired(false)),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            if (targetUser) {
                // Cek 1 user spesifik
                await this.checkSingleUser(interaction, targetUser);
            } else {
                // Cek semua user
                await this.checkAllUsers(interaction);
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: '❌ Terjadi kesalahan saat mengecek status.' 
            });
        }
    },
    
    async checkSingleUser(interaction, targetUser) {
        const stats = await dbHelper.getUserTotal(targetUser.id);
        
        if (stats.count === 0) {
            return interaction.editReply({ 
                content: `❌ **${targetUser.username}** belum pernah donasi.` 
            });
        }
        
        const total = stats.total || 0;
        const member = await interaction.guild.members.fetch(targetUser.id);
        
        // Tentukan role yang seharusnya dimiliki
        let expectedRole = null;
        for (const tier of ROLE_TIERS) {
            if (total >= tier.amount) {
                expectedRole = tier;
                break;
            }
        }
        
        // Cek role yang sedang dimiliki
        const currentRoles = [];
        for (const tier of ROLE_TIERS) {
            if (member.roles.cache.has(tier.roleId)) {
                currentRoles.push(tier);
            }
        }
        
        // Status check
        let status = '✅ Sesuai';
        let color = '#00FF00';
        
        if (expectedRole) {
            const hasCorrectRole = currentRoles.some(r => r.roleId === expectedRole.roleId);
            const hasLowerRoles = currentRoles.some(r => r.amount < expectedRole.amount);
            const hasExtraRoles = currentRoles.length > 1 || (currentRoles.length === 1 && !hasCorrectRole);
            
            if (!hasCorrectRole) {
                status = '❌ Salah/Tidak ada role';
                color = '#FF0000';
            } else if (hasLowerRoles || hasExtraRoles) {
                status = '⚠️ Perlu perbaikan (ada role tambahan)';
                color = '#FFA500';
            }
        } else {
            if (currentRoles.length > 0) {
                status = '⚠️ Punya role tapi belum cukup donasi?';
                color = '#FFA500';
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🔍 Status Check - ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '💵 Total Donasi', value: `Rp ${total.toLocaleString('id-ID')}`, inline: true },
                { name: '📊 Jumlah Transaksi', value: `${stats.count}x`, inline: true },
                { name: '📋 Status', value: status, inline: false }
            );
        
        // Role info
        if (expectedRole) {
            embed.addFields(
                { name: '🎯 Role Seharusnya', value: `**${expectedRole.name}**`, inline: true }
            );
        }
        
        if (currentRoles.length > 0) {
            embed.addFields(
                { name: '🎭 Role Saat Ini', value: currentRoles.map(r => `• ${r.name}`).join('\n'), inline: true }
            );
        } else {
            embed.addFields(
                { name: '🎭 Role Saat Ini', value: 'Tidak ada', inline: true }
            );
        }
        
        // Next tier info
        if (expectedRole) {
            const currentTierIndex = ROLE_TIERS.findIndex(t => t.amount === expectedRole.amount);
            const nextTier = ROLE_TIERS[currentTierIndex - 1]; // Array sorted descending
            
            if (nextTier) {
                const needed = nextTier.amount - total;
                embed.addFields(
                    { name: '📈 Next Tier', value: `${nextTier.name} (kurang Rp ${needed.toLocaleString('id-ID')})`, inline: false }
                );
            }
        } else {
            const firstTier = ROLE_TIERS[ROLE_TIERS.length - 1];
            const needed = firstTier.amount - total;
            embed.addFields(
                { name: '📈 Menuju Donatur', value: `Kurang Rp ${needed.toLocaleString('id-ID')} lagi`, inline: false }
            );
        }
        
        embed.setFooter({ text: 'Gunakan /add untuk update otomatis role' })
             .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },
    
    async checkAllUsers(interaction) {
        const users = await dbHelper.getAllUsers();
        let correct = 0;
        let wrong = 0;
        let noRole = 0;
        
        let wrongList = [];
        
        for (const userData of users) {
            try {
                const stats = await dbHelper.getUserTotal(userData.user_id);
                const total = stats.total || 0;
                
                let member;
                try {
                    member = await interaction.guild.members.fetch(userData.user_id);
                } catch (e) {
                    continue; // User leave server
                }
                
                // Cek expected role
                let expectedRole = null;
                for (const tier of ROLE_TIERS) {
                    if (total >= tier.amount) {
                        expectedRole = tier;
                        break;
                    }
                }
                
                // Cek current roles
                const currentRoles = [];
                for (const tier of ROLE_TIERS) {
                    if (member.roles.cache.has(tier.roleId)) {
                        currentRoles.push(tier);
                    }
                }
                
                // Evaluate
                if (!expectedRole) {
                    if (currentRoles.length === 0) noRole++;
                    else wrong++;
                } else {
                    const hasCorrect = currentRoles.some(r => r.roleId === expectedRole.roleId);
                    const hasExtra = currentRoles.length > 1 || (currentRoles.length === 1 && !hasCorrect);
                    
                    if (hasCorrect && !hasExtra) correct++;
                    else {
                        wrong++;
                        if (wrongList.length < 5) {
                            wrongList.push(`<@${userData.user_id}>: punya ${currentRoles.map(r=>r.name).join(', ')}, seharusnya ${expectedRole.name}`);
                        }
                    }
                }
            } catch (err) {
                // Skip error
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor(wrong > 0 ? '#FFA500' : '#00FF00')
            .setTitle('📊 Batch Status Check')
            .addFields(
                { name: '✅ Role Sesuai', value: `${correct}`, inline: true },
                { name: '⚠️ Perlu Perbaikan', value: `${wrong}`, inline: true },
                { name: '📭 Belum Punya Role', value: `${noRole}`, inline: true }
            );
        
        if (wrongList.length > 0) {
            embed.addFields(
                { name: '🔧 Contoh yang Perlu Fix', value: wrongList.join('\n') }
            );
        }
        
        embed.setFooter({ text: 'Gunakan /add untuk auto-fix role per user' })
             .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
};