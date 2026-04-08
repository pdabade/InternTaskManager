import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  account,
  databases,
  USERS_COLLECTION_ID,
  DB_ID,
  Query,
  tablesDB,
} from "../lib/appwrite";
import type { Models } from "appwrite";
import type { AppUser } from "../types";

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  appUser: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    null,
  );
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const createAppUser = async (u: Models.User<Models.Preferences>) => {
    await tablesDB.createRow(DB_ID, "users", u.$id, {
      email: u.email,
      name: u.name || "",
      role: u.labels[0],
    });
  };

  const fetchAppUser = async (authUser: Models.User<Models.Preferences>) => {
    try {
      const res = await databases.getDocument<AppUser>(
        DB_ID,
        USERS_COLLECTION_ID,
        authUser.$id,
      );
      setAppUser(res as AppUser);
    } catch (error) {
      const appwriteError = error as { code?: number };

      if (appwriteError.code == 404) {
        try {
          await createAppUser(authUser);
        } catch (error: any) {
          console.error(error);
          setUser(null);
          setAppUser(null);
        } finally {
          setLoading(false);
        }
        try {
          const res = await databases.listDocuments<AppUser>(
            DB_ID,
            USERS_COLLECTION_ID,
            [Query.equal("email", authUser.email)],
          );

          setAppUser((res.documents[0] as AppUser) ?? null);
          return;
        } catch (fallbackError) {
          console.error("Error fetching user by email:", fallbackError);
        }
      } else {
        console.error("Error fetching user:", error);
      }

      setAppUser(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const u = await account.get();
        setUser(u);
        await fetchAppUser(u);
      } catch (error: any) {
        if (error.code !== 401) {
          console.error(error);
        }
        setUser(null);
        setAppUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    await account.createEmailPasswordSession({ email, password });
    const loggedInUser = await account.get();
    setUser(loggedInUser);
    await fetchAppUser(loggedInUser);
  };

  const logout = async (): Promise<void> => {
    await account.deleteSession("current");
    setUser(null);
    setAppUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, appUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error("useAuthContext must be used inside <AuthProvider>");
  return ctx;
}
