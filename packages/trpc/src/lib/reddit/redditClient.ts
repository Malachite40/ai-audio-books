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

  /** Fetch comments for a post by permalink (e.g. /r/sub/comments/id/title/) */
  async getCommentsByPermalink(
    permalink: string,
    opts?: { limit?: number; depth?: number }
  ) {
    const path = permalink.startsWith("/") ? permalink : `/${permalink}`;
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.depth) params.set("depth", String(opts.depth));

    // Reddit returns [post, commentsListing]
    const json = await this.request<any>(`${path}.json?${params.toString()}`);
    const commentsListing =
      Array.isArray(json) && json.length > 1 ? json[1] : null;
    const children = commentsListing?.data?.children ?? [];

    // Flatten and normalize basic fields
    const flatten = (nodes: any[], depth = 0): any[] => {
      const out: any[] = [];
      for (const n of nodes) {
        if (n.kind !== "t1") continue; // comments are t1
        const d = n.data ?? {};
        out.push({
          id: String(d.id || d.name || ""),
          name: String(d.name || ""),
          parentId: typeof d.parent_id === "string" ? d.parent_id : undefined,
          author: typeof d.author === "string" ? d.author : null,
          body: typeof d.body === "string" ? d.body : "",
          score: typeof d.score === "number" ? d.score : null,
          createdUtc: d.created_utc
            ? new Date(d.created_utc * 1000).toISOString()
            : undefined,
          depth,
          authorIcon:
            typeof d.author_icon_img === "string" && d.author_icon_img
              ? d.author_icon_img
              : undefined,
        });
        // replies can be an object or empty string
        const replies =
          d.replies && typeof d.replies === "object"
            ? (d.replies.data?.children ?? [])
            : [];
        if (replies.length) out.push(...flatten(replies, depth + 1));
      }
      return out;
    };

    return flatten(children, 0);
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
          Buffer.from(
            `${this.creds.clientId}:${this.creds.clientSecret}`
          ).toString("base64"),
        "User-Agent": this.creds.userAgent,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get Reddit token: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
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

    const response = res.json();
    return response as Promise<T>;
  }

  getSubreddit(name: string) {
    const self = this;
    const encodedName = encodeURIComponent(name);
    return {
      async getInfo() {
        const json = await self.request<{ data: any }>(
          `/r/${encodedName}/about.json`
        );
        const d = json?.data ?? {};
        const displayName = String(
          d.display_name || d.name || name || d.id || ""
        );
        const prefixedName = String(
          d.display_name_prefixed ||
            (displayName ? `r/${displayName}` : `r/${name}`)
        );
        const subscribers =
          typeof d.subscribers === "number" ? d.subscribers : undefined;
        const title = typeof d.title === "string" ? d.title : undefined;
        const description =
          typeof d.public_description === "string"
            ? d.public_description
            : undefined;
        const over18 = Boolean(d.over18);
        const icon =
          typeof d.community_icon === "string" && d.community_icon
            ? d.community_icon.split("?")[0]
            : typeof d.icon_img === "string" && d.icon_img
              ? d.icon_img.split("?")[0]
              : undefined;

        return {
          name: displayName,
          prefixedName,
          subscribers,
          title,
          description,
          over18,
          icon,
          raw: d,
        };
      },
      async getHot(opts?: ListingOptions) {
        return self.getListing(`/r/${encodedName}/hot.json`, opts);
      },
      async getNew(opts?: ListingOptions) {
        return self.getListing(`/r/${encodedName}/new.json`, opts);
      },
      async getRising(opts?: ListingOptions) {
        return self.getListing(`/r/${encodedName}/rising.json`, opts);
      },
      async getTop(opts?: ListingOptions) {
        return self.getListing(`/r/${encodedName}/top.json`, opts);
      },
      async getControversial(opts?: ListingOptions) {
        return self.getListing(`/r/${encodedName}/controversial.json`, opts);
      },
    };
  }

  private async getListing(path: string, opts?: ListingOptions) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    const json = await this.request<{ data: { children: any[] } }>(
      `${path}?${params.toString()}`
    );
    return json.data.children.map((c) => c.data);
  }

  /**
   * Search for subreddits by keyword by querying cross-subreddit posts and extracting subreddit names.
   * Returns a de-duplicated list of subreddit names and their r/ prefixed form.
   */
  async searchSubreddits(term: string, opts?: { limit?: number }) {
    const params = new URLSearchParams();
    params.set("q", term);
    // Search across all subreddits (not restricted to a single sr)
    params.set("restrict_sr", "false");
    // Keep it focused on posts, which contain subreddit fields reliably
    params.set("type", "link");
    if (opts?.limit)
      params.set("limit", String(Math.min(200, Math.max(1, opts.limit))));

    const json = await this.request<{
      data: { children: Array<{ data: any }> };
    }>(`/search.json?${params.toString()}`);

    const counts = new Map<
      string,
      { name: string; prefixed: string; count: number }
    >();
    for (const child of json.data.children || []) {
      const d = child?.data ?? {};
      const name = typeof d?.subreddit === "string" ? d.subreddit : undefined;
      const pref =
        typeof d?.subreddit_name_prefixed === "string"
          ? d.subreddit_name_prefixed
          : name
            ? `r/${name}`
            : undefined;
      if (!name || !pref) continue;
      const curr = counts.get(name);
      if (curr) curr.count += 1;
      else counts.set(name, { name, prefixed: pref, count: 1 });
    }

    // Sort by frequency desc, then alphabetical by name
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map(({ name, prefixed }) => ({ name, prefixed }));
  }

  /**
   * Search subreddits via the native endpoint: /subreddits/search.json?q=
   * Returns display info straight from the subreddit listing.
   */
  async searchSubredditsApi(term: string, opts?: { limit?: number }) {
    const params = new URLSearchParams();
    params.set("q", term);
    if (opts?.limit)
      params.set("limit", String(Math.min(200, Math.max(1, opts.limit))));

    const json = await this.request<{
      data: { children: Array<{ data: any }> };
    }>(`/subreddits/search.json?${params.toString()}`);

    return (json.data.children || []).map((c) => {
      const d = c?.data ?? {};
      const name = String(d.display_name || d.name || d.id || "");
      const prefixed = String(
        d.display_name_prefixed || (name ? `r/${name}` : "")
      );
      const subscribers =
        typeof d.subscribers === "number" ? d.subscribers : undefined;
      const title = typeof d.title === "string" ? d.title : undefined;
      const description =
        typeof d.public_description === "string"
          ? d.public_description
          : undefined;
      return { name, prefixed, subscribers, title, description };
    });
  }

  /**
   * Find similar/recommended subreddits for a given subreddit name.
   *
   * First tries Reddit's recommendation endpoint `/api/recommend/sr/{srnames}`.
   * If that returns too few or zero items, falls back to the internal
   * `/api/similar_subreddits?sr_fullnames=t5_xxx` endpoint using the
   * subreddit's fullname from `/r/{name}/about.json`.
   *
   * The response shape is not formally documented, so this method normalizes
   * a few common field variants into the same shape as `searchSubredditsApi`.
   */
  async getSimilarSubreddits(name: string, opts?: { limit?: number }) {
    const limit = opts?.limit ?? 25;
    const bareName = name.replace(/^r\//i, "").trim();
    const encoded = encodeURIComponent(bareName);

    // Helper to normalize various response shapes (array vs listing).
    const extractItems = (json: any): any[] => {
      if (Array.isArray(json)) return json;
      if (json && typeof json === "object") {
        if (Array.isArray(json.data?.children)) {
          return json.data.children.map((c: any) => c?.data ?? c);
        }
        if (Array.isArray(json.subreddits)) {
          // some internal endpoints use { subreddits: [...] }
          return json.subreddits;
        }
      }
      return [];
    };

    // Helper to normalize a raw subreddit-ish object into your shape.
    const normalizeSub = (s: any) => {
      const rawName =
        (typeof s.display_name === "string" && s.display_name) ||
        (typeof s.name === "string" && s.name) ||
        (typeof s.sr_name === "string" && s.sr_name) ||
        (typeof s.id === "string" && s.id) ||
        bareName;

      const bare = String(rawName).replace(/^r\//i, "");

      const prefixed =
        (typeof s.display_name_prefixed === "string" &&
          s.display_name_prefixed) ||
        (typeof s.prefixed_name === "string" && s.prefixed_name) ||
        (bare ? `r/${bare}` : "");

      const subscribersCandidate =
        typeof s.subscribers === "number"
          ? s.subscribers
          : typeof s.subscriber_count === "number"
            ? s.subscriber_count
            : undefined;

      const title =
        (typeof s.title === "string" && s.title) ||
        (typeof s.public_description === "string" && s.public_description) ||
        undefined;

      const description =
        (typeof s.public_description === "string" && s.public_description) ||
        (typeof s.description === "string" && s.description) ||
        undefined;

      return {
        name: bare,
        prefixed,
        subscribers: subscribersCandidate,
        title,
        description,
      };
    };

    // --- 1) Primary: /api/recommend/sr/{name}.json -------------------------
    const recommendJson = await this.request<
      | Array<any>
      | {
          data?: { children?: Array<{ data?: any }> };
          error?: number;
          message?: string;
          reason?: string;
        }
    >(`/api/recommend/sr/${encoded}.json?sr_detail=1&limit=${limit}`);

    // If Reddit returned an explicit error object, surface it instead of
    // silently turning it into an empty array.
    if (
      !Array.isArray(recommendJson) &&
      recommendJson &&
      typeof recommendJson === "object" &&
      "error" in recommendJson
    ) {
      throw new Error(
        `Reddit recommend/sr error: ${(recommendJson as any).error} ${
          (recommendJson as any).message ?? ""
        } ${(recommendJson as any).reason ?? ""}`
      );
    }

    const recommendRaw = extractItems(recommendJson);
    const recommendNorm = recommendRaw.map(normalizeSub);

    // We'll merge multiple sources and dedupe by lowercased name.
    const byName = new Map<
      string,
      {
        name: string;
        prefixed: string;
        subscribers?: number;
        title?: string;
        description?: string;
      }
    >();
    const addMany = (items: ReturnType<typeof normalizeSub>[]) => {
      for (const item of items) {
        const key = item.name.toLowerCase();
        const existing = byName.get(key);
        if (!existing) {
          byName.set(key, item);
        } else {
          // Prefer the one with more subscribers if we see duplicates.
          const existingSubs = existing.subscribers ?? 0;
          const newSubs = item.subscribers ?? 0;
          if (newSubs > existingSubs) {
            byName.set(key, item);
          }
        }
      }
    };

    addMany(recommendNorm);

    // --- 2) Fallback layer: /api/similar_subreddits ------------------------
    if (byName.size < limit) {
      try {
        // Get fullname (t5_xxx) from /about.json
        const about = await this.request<{ data?: { name?: string } }>(
          `/r/${encoded}/about.json`
        );
        const fullname = about?.data?.name; // e.g. "t5_2qh0y"

        if (fullname) {
          const similarJson = await this.request<any>(
            `/api/similar_subreddits?sr_fullnames=${encodeURIComponent(
              fullname
            )}`
          );

          const similarRaw = extractItems(similarJson);
          const similarNorm = similarRaw.map(normalizeSub);
          addMany(similarNorm);
        }
      } catch (e) {
        console.warn("similar_subreddits fallback failed:", e);
      }
    }

    // Turn map back into an array, respect limit.
    const merged = Array.from(byName.values());

    // Optional: sort by subscribers desc, then name
    merged.sort(
      (a, b) =>
        (b.subscribers ?? 0) - (a.subscribers ?? 0) ||
        a.name.localeCompare(b.name)
    );

    if (merged.length > limit) return merged.slice(0, limit);
    return merged;
  }

  /** Fetch subreddit rules via /r/{name}/about/rules.json */
  async getSubredditRules(name: string) {
    const json = await this.request<{
      rules: Array<{
        short_name?: string;
        description?: string;
        description_html?: string;
        priority?: number;
        violation_reason?: string;
        created_utc?: number;
      }>;
      site_rules?: string[];
    }>(`/r/${encodeURIComponent(name)}/about/rules.json`);

    const items = (json.rules || []).map((r) => ({
      shortName: r.short_name ?? "",
      description: r.description ?? "",
      descriptionHtml: r.description_html ?? undefined,
      priority: typeof r.priority === "number" ? r.priority : undefined,
      violationReason: r.violation_reason ?? undefined,
      createdUtc: r.created_utc
        ? new Date(r.created_utc * 1000).toISOString()
        : undefined,
    }));
    const siteRules = json.site_rules ?? [];
    return { items, siteRules };
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
