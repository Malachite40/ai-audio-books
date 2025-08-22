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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { HistoryIcon } from "lucide-react";
import { AudioHistory } from "./audio/audio-history";

export type AudioHistoryDrawerProps = {};

export function AudioHistoryDrawer() {
  const { open, setOpen } = useAudioHistoryStore();
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Tooltip>
        <DrawerTrigger asChild>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon">
              <HistoryIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
        </DrawerTrigger>
        <TooltipContent>Audio History</TooltipContent>
      </Tooltip>
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
