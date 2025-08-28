"use client";

import { useAudioHistoryStore } from "@/store/audio-history-store";
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
import { AudioHistory } from "./audio/audio-history";

export type AudioHistoryDrawerProps = {};

export function AudioHistoryDrawer() {
  const { open, setOpen } = useAudioHistoryStore();
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button type="button" variant="ghost">
          History
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-9/12">
        <DrawerHeader>
          <DrawerTitle>Audio History</DrawerTitle>
          <DrawerDescription>
            Your listened audiobooks history.
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-4 overflow-auto">
          <AudioHistory />
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
