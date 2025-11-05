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
