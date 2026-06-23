import { DB_URI } from "../config/config.service";
import { connect } from "mongoose";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
const connectDB = async () => {
  try {
    await connect(DB_URI);
    console.log("DB connected successfully");
  } catch (error) {
    console.log(`fail to connect DB: ${error}`);
  }
};

export default connectDB;