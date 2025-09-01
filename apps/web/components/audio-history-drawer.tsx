"use client";

import { useAudioHistoryStore } from "@/store/use-audio-history-store";
import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { AudioFileFavorites } from "./audio/audio-file-favorites";
import { AudioHistory } from "./audio/audio-history";
export type AudioHistoryDrawerProps = {};
export function AudioHistoryDrawer() {
  const { open, setOpen, selectedTab, setSelectedTab } = useAudioHistoryStore();
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button type="button" variant="ghost">
          Library
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-9/12">
        <DrawerHeader>
          <DrawerTitle>Library</DrawerTitle>
          <Tabs defaultValue="my-creations" value={selectedTab}>
            <TabsList className="w-full md:w-fit">
              <TabsTrigger
                value="my-creations"
                onClick={() => setSelectedTab("my-creations")}
              >
                My Creations
              </TabsTrigger>
              <TabsTrigger
                value="favorites"
                onClick={() => setSelectedTab("favorites")}
              >
                Favorites
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <DrawerDescription></DrawerDescription>
        </DrawerHeader>
        <div className="px-4 flex-1 overflow-auto">
          {selectedTab === "my-creations" ? (
            <AudioHistory />
          ) : (
            <AudioFileFavorites />
          )}
        </div>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
