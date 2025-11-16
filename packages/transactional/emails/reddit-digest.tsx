import { Heading, Link, Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout, InfoBox } from "../src/components";
import { colors, typography } from "../src/styles";

type RedditDigestPost = {
  id: string;
  title: string;
  subreddit: string;
  url?: string;
  score: number;
  reasoning: string;
  exampleMessage?: string;
  createdAt: Date | string;
};

type RedditDigestEmailProps = {
  posts: RedditDigestPost[];
  windowHours: number;
  minScore: number;
  campaignPath?: string;
  summary?: {
    threshold: number;
    totalRecentUnarchived: number;
    subredditStats: {
      subreddit: string;
      total: number;
      aboveThreshold: number;
      successRate: number;
    }[];
  };
};

function RedditDigestEmail({
  posts,
  windowHours,
  minScore,
  campaignPath,
  summary,
}: RedditDigestEmailProps) {
  const preview = `Your top organic growth opportunities on Reddit from the last ${windowHours} hours.`;
  const baseUrl = process.env.FRONTEND_URL || "https://instantaudio.online";
  const defaultCampaignPath = "/campaign/65c937fe-57b0-4ac6-b789-dc57554f6144";
  const campaignHref = `${baseUrl}${campaignPath ?? defaultCampaignPath}`;

  return (
    <EmailLayout preview={preview}>
      <Heading style={typography.h1}>Daily Summary</Heading>

      {summary && (
        <InfoBox variant="highlight">
          <Section
            style={{
              borderLeft: `4px solid ${colors.primary}`,
              paddingLeft: "12px",
              paddingRight: "4px",
            }}
          >
            <Text
              style={{
                ...typography.small,
                textAlign: "left",
                margin: "0 0 6px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: colors.text.secondary,
              }}
            >
              ⚡ Campaign summary
            </Text>

            <Text
              style={{
                ...typography.body,
                textAlign: "left",
                margin: "0 0 6px",
                maxWidth: "100%",
              }}
            >
              {summary.totalRecentUnarchived} posts scored in the last{" "}
              {windowHours}h at threshold ≥ {summary.threshold}.
            </Text>

            <Text
              style={{
                ...typography.small,
                textAlign: "left",
                margin: "0 0 10px",
                color: colors.text.secondary,
              }}
            >
              Across {summary.subredditStats.length} subreddits.
            </Text>

            {summary.subredditStats.map((stat) => (
              <Text
                key={stat.subreddit}
                style={{
                  ...typography.small,
                  textAlign: "left",
                  margin: "0 0 6px",
                  padding: "4px 8px",
                  borderRadius: "999px",
                  backgroundColor: colors.background.white,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {/* left side */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      color:
                        stat.successRate >= 80
                          ? colors.success
                          : stat.successRate >= 50
                            ? colors.warning
                            : colors.error,
                    }}
                  >
                    ●
                  </span>
                  <strong>r/{stat.subreddit}</strong>
                </span>

                {/* right side */}
                <span style={{ marginLeft: "auto" }}>
                  {stat.successRate}% – ({stat.aboveThreshold}/{stat.total})
                  posts
                </span>
              </Text>
            ))}
          </Section>
        </InfoBox>
      )}

      <Heading style={typography.h1}>Organic growth opportunities</Heading>

      <Text
        style={{
          ...typography.body,
          textAlign: "left",
          maxWidth: "100%",
        }}
      >
        Here are Reddit posts from the last {windowHours} hours that scored at
        least {minScore} and look like strong opportunities to engage, add
        value, and naturally mention your product or content.
      </Text>

      {posts.map((post) => (
        <InfoBox key={post.id}>
          <Text
            style={{
              ...typography.small,
              textAlign: "left",
              marginBottom: "4px",
            }}
          >
            r/{post.subreddit} • Score {post.score}
          </Text>

          <Text
            style={{
              ...typography.body,
              textAlign: "left",
              margin: "0 0 8px",
              maxWidth: "100%",
            }}
          >
            {post.url ? (
              <Link href={post.url} style={{ textDecoration: "none" }}>
                {post.title}
              </Link>
            ) : (
              post.title
            )}
          </Text>

          <Text
            style={{
              ...typography.small,
              textAlign: "left",
              margin: "0 0 8px",
            }}
          >
            <strong>Why this looks promising:</strong> {post.reasoning}
          </Text>

          {post.exampleMessage && (
            <Text
              style={{
                ...typography.small,
                textAlign: "left",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              <strong>Example reply you could send:</strong>{" "}
              {post.exampleMessage}
            </Text>
          )}
          <Section
            style={{
              width: "100%",
              marginTop: "16px",
              textAlign: "right",
            }}
          >
            <EmailButton
              style={{ display: "inline-block" }}
              variant="primary"
              href={campaignHref}
            >
              View in Dashboard →
            </EmailButton>
          </Section>
        </InfoBox>
      ))}
    </EmailLayout>
  );
}

RedditDigestEmail.PreviewProps = {
  windowHours: 24,
  minScore: 85,
  summary: {
    threshold: 75,
    totalRecentUnarchived: 12,
    subredditStats: [
      {
        subreddit: "learnprogramming",
        total: 5,
        aboveThreshold: 4,
        successRate: 80,
      },
      {
        subreddit: "javascript",
        total: 7,
        aboveThreshold: 5,
        successRate: 71,
      },
      { subreddit: "webdev", total: 3, aboveThreshold: 1, successRate: 33 },
    ],
  },
  posts: [
    {
      id: "t3_abcdef",
      title: "How to learn TypeScript effectively?",
      subreddit: "learnprogramming",
      url: "https://www.reddit.com/r/learnprogramming/comments/abcdef/how_to_learn_typescript_effectively/",
      score: 85,
      reasoning:
        "This post has a high score and is asking for learning resources, which is a great opportunity to share your content.",
      exampleMessage:
        "Hi there! I saw your question about learning TypeScript. I highly recommend checking out [Your Content/Product], which offers comprehensive guides and tutorials that can help you get started quickly. Best of luck on your learning journey!",
      createdAt: new Date().toISOString(),
    },
    {
      id: "t3_ghijkl",
      title: "Best practices for async programming in JavaScript?",
      subreddit: "javascript",
      url: "https://www.reddit.com/r/javascript/comments/ghijkl/best_practices_for_async_programming_in_javascript/",
      score: 90,
      reasoning:
        "This post is engaging with a common topic and has a decent score, making it a good chance to provide value.",
      exampleMessage:
        "Hello! Regarding your question on async programming best practices, I suggest looking into [Your Content/Product]. It covers various strategies and patterns that can help you write cleaner and more efficient asynchronous code. Hope this helps!",
      createdAt: new Date().toISOString(),
    },
  ],
} as RedditDigestEmailProps;

export default RedditDigestEmail;
