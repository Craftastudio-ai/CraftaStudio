import { Daytona } from "@daytonaio/sdk";

if (!process.env.DAYTONA_API_KEY) {
  throw new Error("DAYTONA_API_KEY environment variable is not set");
}

const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  // Explicitly set a target region so sandbox creation never fails with
  // "organization does not have a default region".
  // Value must match what's configured in your Daytona dashboard.
  // Override via DAYTONA_TARGET env var so you don't need to redeploy.
  target: process.env.DAYTONA_TARGET ?? "us",
});

export default daytona;
