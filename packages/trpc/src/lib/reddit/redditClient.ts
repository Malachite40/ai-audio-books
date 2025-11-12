import { env } from "../../env";

interface RedditCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  userAgent: string;
}

interface ListingOptions {
  limit?: number;
}

export class RedditClient {
  private creds: RedditCredentials;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(creds: RedditCredentials) {
    this.creds = creds;
  }

  private async ensureToken(): Promise<void> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt) return;

    const body = new URLSearchParams({
      grant_type: "password",
      username: this.creds.username,
      password: this.creds.password,
    });

    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${this.creds.clientId}:${this.creds.clientSecret}`).toString("base64"),
        "User-Agent": this.creds.userAgent,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get Reddit token: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 30) * 1000; // refresh slightly early
  }

  private async request<T>(path: string): Promise<T> {
    await this.ensureToken();

    const res = await fetch(`https://oauth.reddit.com${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "User-Agent": this.creds.userAgent,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Reddit API error: ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  getSubreddit(name: string) {
    const self = this;
    return {
      async getHot(opts?: ListingOptions) {
        return self.getListing(`/r/${name}/hot.json`, opts);
      },
      async getNew(opts?: ListingOptions) {
        return self.getListing(`/r/${name}/new.json`, opts);
      },
      async getRising(opts?: ListingOptions) {
        return self.getListing(`/r/${name}/rising.json`, opts);
      },
      async getTop(opts?: ListingOptions) {
        return self.getListing(`/r/${name}/top.json`, opts);
      },
      async getControversial(opts?: ListingOptions) {
        return self.getListing(`/r/${name}/controversial.json`, opts);
      },
    };
  }

  private async getListing(path: string, opts?: ListingOptions) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    const json = await this.request<{ data: { children: any[] } }>(
      `${path}?${params.toString()}`,
    );
    return json.data.children.map((c) => c.data);
  }
}

// Factory using env (convenience when used within this package)
export function createRedditClientFromEnv() {
  return new RedditClient({
    userAgent: env.REDDIT_USER_AGENT,
    clientId: env.REDDIT_CLIENT_ID,
    clientSecret: env.REDDIT_CLIENT_SECRET,
    username: env.REDDIT_USERNAME,
    password: env.REDDIT_PASSWORD,
  });
}

