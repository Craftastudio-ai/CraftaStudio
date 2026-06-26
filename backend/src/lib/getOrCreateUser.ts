import prisma from "./prisma";

// In-memory cache: clerkId → { user, expiresAt }
// Eliminates heavy DB join (user→teamMemberships→team→projects) on every request.
const userCache = new Map<string, { user: any; expiresAt: number }>();
const USER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ClerkUserData {
  email: string | null;
  name: string | null;
}

/**
 * Fetches the user's email and name from the Clerk API.
 * Used when creating a new user record in our database.
 */
async function fetchClerkUser(clerkId: string): Promise<ClerkUserData> {
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    if (!res.ok) {
      console.error(`Clerk API error: ${res.status} for user ${clerkId}`);
      return { email: null, name: null };
    }

    const data = await res.json() as any;

    const email =
      data.email_addresses?.find((e: any) => e.id === data.primary_email_address_id)
        ?.email_address ??
      data.email_addresses?.[0]?.email_address ??
      null;

    const name =
      [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || null;

    return { email, name };
  } catch (err) {
    console.error("Failed to fetch user from Clerk API:", err);
    return { email: null, name: null };
  }
}

/**
 * Finds an existing user by their Clerk ID, or creates a new one
 * by fetching their profile from Clerk and saving it to the database.
 */
export async function getOrCreateUser(clerkId: string) {
  try {
    const cached = userCache.get(clerkId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    console.log("[getOrCreateUser] Starting for clerkId:", clerkId);
    let user = await prisma.user.findUnique({
      where: { clerkId },
      include: {
        teamMemberships: {
          include: {
            team: {
              include: {
                projects: true
              }
            }
          }
        }
      }
    }) as any;

    if (!user) {
      console.log("[getOrCreateUser] User not found by clerkId, fetching from Clerk...");
      const { email, name } = await fetchClerkUser(clerkId);
      console.log("[getOrCreateUser] Clerk data fetched:", { email, name });

      // Check if user exists by email (in case clerkId changed or was updated)
      if (email) {
        const existingUserByEmail = await prisma.user.findUnique({
          where: { email },
          include: {
            teamMemberships: {
              include: {
                team: {
                  include: {
                    projects: true
                  }
                }
              }
            }
          }
        }) as any;

        if (existingUserByEmail) {
          console.log("[getOrCreateUser] Found existing user by email, updating clerkId...");
          // Update the clerkId for this user
          user = await prisma.user.update({
            where: { id: existingUserByEmail.id },
            data: { clerkId },
            include: {
              teamMemberships: {
                include: {
                  team: {
                    include: {
                      projects: true
                    }
                  }
                }
              }
            }
          }) as any;
          console.log("[getOrCreateUser] ClerkId updated successfully");
        }
      }

      // If still no user found, create a new one
      if (!user) {
        console.log("[getOrCreateUser] Creating new user...");
        const newUser = await prisma.user.create({
          data: { clerkId, email, name }
        });

        const newTeam = await prisma.team.create({
          data: {
            name: "Personal Workspace",
            members: {
              create: [{ user: { connect: { id: newUser.id } }, role: 'owner' }]
            },
            projects: {
              create: [{ name: "My First Architecture" }]
            }
          },
          include: { projects: true }
        });

        // Re-fetch to ensure we have the fully joined object exactly like findUnique returns
        user = await prisma.user.findUnique({
          where: { id: newUser.id },
          include: {
            teamMemberships: {
              include: {
                team: {
                  include: { projects: true }
                }
              }
            }
          }
        });
        if (!user) throw new Error("Failed to re-fetch newly created user");
        console.log("[getOrCreateUser] User created successfully");
      }
    }

    // Map teamMemberships to a virtual 'teams' array for the rest of the app's convenience
    if (user && user.teamMemberships) {
      user.teams = user.teamMemberships.map((m: any) => ({
        ...m.team,
        role: m.role
      }));
    }

    // Ensure an existing user who somehow lacks a team/project gets one
    if (user && user.teamMemberships.length === 0) {
      console.log("[getOrCreateUser] User lacks team, checking DB again to prevent race...");
      const existingTeam = await prisma.teamMember.findFirst({ 
        where: { userId: user.id },
        include: { team: { include: { projects: true } } }
      });
      if (!existingTeam) {
        const newTeam = await prisma.team.create({
          data: {
            name: "Personal Workspace",
            members: {
              create: [{ user: { connect: { id: user.id } }, role: 'owner' }]
            },
            projects: {
              create: [{ name: "My First Architecture" }]
            }
          },
          include: { projects: true }
        });
        user.teamMemberships = [{
          id: '', // dummy
          teamId: newTeam.id,
          userId: user.id,
          role: 'owner',
          joinedAt: new Date(),
          updatedAt: new Date(),
          team: newTeam
        }] as any;
        user.teams = [{ ...newTeam, role: 'owner' }];
      } else {
        user.teamMemberships = [existingTeam] as any;
        user.teams = [{ ...existingTeam.team, role: existingTeam.role }];
      }
    }
    
    if (user && user.teamMemberships.length > 0 && user.teamMemberships[0].team.projects.length === 0) {
      console.log("[getOrCreateUser] User lacks project, checking DB again to prevent race...");
      const existingProject = await prisma.project.findFirst({ where: { teamId: user.teamMemberships[0].team.id } });
      if (!existingProject) {
        const newProject = await prisma.project.create({
          data: {
            name: "My First Architecture",
            teamId: user.teamMemberships[0].team.id
          }
        });
        user.teamMemberships[0].team.projects = [newProject];
        if (user.teams?.[0]) user.teams[0].projects = [newProject];
      } else {
        user.teamMemberships[0].team.projects = [existingProject];
        if (user.teams?.[0]) user.teams[0].projects = [existingProject];
      }
    }

    console.log("[getOrCreateUser] Returning user with project:", user?.teamMemberships?.[0]?.team?.projects?.[0]?.id);
    userCache.set(clerkId, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    return user;
  } catch (err: any) {
    console.error("[getOrCreateUser] FATAL ERROR:", err.message);
    throw err;
  }
}
