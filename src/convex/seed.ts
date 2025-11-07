import { mutation } from "./_generated/server";
import { createAuth } from "./auth";

export const seedUsers = mutation({
    handler: async (ctx) => {
        const auth = createAuth(ctx);

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            throw new Error("Missing admin credentials in environment variables.");
        }

        // 1. Create Super Admin
        try {
            await auth.api.createUser({
                body: {
                    email: adminEmail,
                    password: adminPassword,
                    name: "Super Admin",
                    role: "ADMIN",
                    data: {
                        appRole: "ADMIN",
                        userType: "ORG",
                    }
                }
            });
            console.log("Super Admin created successfully.");
        } catch (error: any) {
            if (error.message.includes("User already exists")) {
                console.log("Super Admin already exists.");
            } else {
                throw error;
            }
        }
    }
});

export const seedTournament = mutation({
    handler: async (ctx) => {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

        // Get or create admin user in Convex users table
        let adminUser = await ctx.db
            .query('users')
            .withIndex('email', (q) => q.eq('email', adminEmail))
            .unique();

        if (!adminUser) {
            // Create admin user directly in Convex for seeding
            const now = Date.now();
            const adminUserId = await ctx.db.insert('users', {
                authId: 'seed-admin-auth-id', // Placeholder authId for seeding
                email: adminEmail,
                fullName: 'Seed Admin',
                appRole: 'ADMIN',
                userType: 'ORG',
                createdAt: now,
                updatedAt: now
            });
            adminUser = await ctx.db.get(adminUserId);
            if (!adminUser) {
                throw new Error("Failed to create admin user");
            }
        }

        const now = Date.now();

        // Create tournament
        const tournamentId = await ctx.db.insert('tournaments', {
            created_at: now,
            created_by: adminUser._id,
            tournament_alliance_team_limit: 3,
            tournament_code: 'TEST2024',
            tournament_name: 'Test Tournament 2024',
            tournament_owner_id: adminUser._id,
            tournament_status: 'DRAFT',
            tournament_visibility: 'PUBLIC',
            team_capacity: 16,
            updated_at: now,
            updated_by: adminUser._id
        });

        console.log(`Created tournament: ${tournamentId}`);

        // Create 16 teams
        const teams = [];
        for (let i = 1; i <= 16; i++) {
            // Generate team number with leading zeros
            const teamNumber = i.toString().padStart(4, '0');

            const teamId = await ctx.db.insert('teams', {
                created_at: now,
                created_by: adminUser._id,
                location: `Test City ${i}`,
                max_members: 10,
                status: 'ACTIVE',
                team_name: `Test Team ${i}`,
                team_number: teamNumber,
                updated_at: now,
                updated_by: adminUser._id
            });

            teams.push({ id: teamId, number: teamNumber });
            console.log(`Created team: ${teamNumber} - ${teamId}`);
        }

        // Register teams for tournament
        for (const team of teams) {
            await ctx.db.insert('team_tournament_participation', {
                created_at: now,
                created_by: adminUser._id,
                is_active: true,
                registration_date: now,
                robot_name: `Robot ${team.number}`,
                team_id: team.id,
                tournament_id: tournamentId,
                updated_at: now,
                updated_by: adminUser._id
            });

            console.log(`Registered team ${team.number} for tournament`);
        }

        console.log('Seed completed successfully!');
        return {
            tournamentId,
            teamCount: teams.length
        };
    }
});
