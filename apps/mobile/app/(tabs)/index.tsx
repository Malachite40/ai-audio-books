import { HelloWave } from "@/components/HelloWave";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { authClient } from "@/lib/client-auth";
import * as Linking from "expo-linking";
import React from "react";
import { Button, Image, Platform, StyleSheet } from "react-native";

export default function HomeScreen() {
  const handleLoginWithGoogle = async () => {
    try {
      const callbackURL = Linking.createURL("/");
      const { data, error } = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
      if (error) {
        console.error("Auth request error:", error);
        return;
      }
      console.log("Auth request completed");
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLoginWithApple = async () => {
    try {
      const callbackURL = Linking.createURL("/");
      const { data, error } = await authClient.signIn.social({
        provider: "apple",
        callbackURL,
      });
      console.log({ data });
      if (error) {
        console.error("Auth request error:", error);
        return;
      }
      console.log("Auth request completed");
    } catch (error) {
      console.error("Login error:", error);
    }
  };
  const { data: session } = authClient.useSession();

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
      headerImage={
        <Image
          source={require("@/assets/images/partial-react-logo.png")}
          style={styles.reactLogo}
        />
      }
    >
      {session ? (
        <ThemedView style={styles.stepContainer}>
          <ThemedText type="defaultSemiBold">
            {`Hello ${session.user.name}!`}
          </ThemedText>

          <Button
            title="Sign Out"
            onPress={async () => {
              await authClient.signOut();
            }}
          />
        </ThemedView>
      ) : (
        <React.Fragment>
          <Button title="Login with Apple" onPress={handleLoginWithApple} />
          <Button title="Login with Google" onPress={handleLoginWithGoogle} />
        </React.Fragment>
      )}
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit{" "}
          <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText>{" "}
          to see changes. Press{" "}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: "cmd + d",
              android: "cmd + m",
              web: "F12",
            })}
          </ThemedText>{" "}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 2: Explore</ThemedText>
        <ThemedText>
          Tap the Explore tab to learn more about what's included in this
          starter app.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          When you're ready, run{" "}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText>{" "}
          to get a fresh <ThemedText type="defaultSemiBold">app</ThemedText>{" "}
          directory. This will move the current{" "}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{" "}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
