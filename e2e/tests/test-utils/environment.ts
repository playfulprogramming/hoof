import path from "path";
import { loadEnvFile } from "process";

loadEnvFile(path.join(import.meta.dirname, "../../../.env.example"));
