import { Client, Account, Databases, TablesDB } from "appwrite";

const appwriteEndpoint = import.meta.env.VITE_APPWRITE_ENDPOINT ?? '';
const appwriteProjectId = import.meta.env.VITE_APPWRITE_PROJECT_ID ?? '';

const client = new Client()
  .setEndpoint(appwriteEndpoint)
  .setProject(appwriteProjectId);

export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const databases = new Databases(client);
export { ID, Query } from "appwrite";
 
// Replace these with your actual IDs from the Appwrite Console
export const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
export const TASKS_COLLECTION_ID = import.meta.env.VITE_APPWRITE_TASKS_COLLECTION_ID;
export const SUBMISSIONS_COLLECTION_ID = import.meta.env.VITE_APPWRITE_SUBMISSIONS_COLLECTION_ID;
export const USERS_COLLECTION_ID = import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID;

