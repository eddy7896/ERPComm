"use client";

import { useState } from "react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";
import { Input } from "@/components/ui/input";
import { Search, Image as ImageIcon, Sticker as StickerIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY || "dc6zaTOxFJmzC");

interface GiphyPickerProps {
  onSelect: (url: string) => void;
  defaultTab?: "gifs" | "stickers";
}

export function GiphyPicker({ onSelect, defaultTab = "gifs" }: GiphyPickerProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(defaultTab);

  const fetchGifs = (offset: number) => 
    gf.search(search || "trending", { offset, limit: 10, type: activeTab === "gifs" ? "gifs" : "stickers" });

  return (
    <div className="flex flex-col gap-2 w-[300px] h-[400px] p-2 bg-white dark:bg-zinc-950 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
        <Input
          placeholder={`Search ${activeTab === "gifs" ? "GIFs" : "Stickers"}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="gifs" className="text-xs flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> GIFs
          </TabsTrigger>
          <TabsTrigger value="stickers" className="text-xs flex items-center gap-1.5">
            <StickerIcon className="h-3.5 w-3.5" /> Stickers
          </TabsTrigger>
        </TabsList>
        <div className="mt-2 h-[300px] overflow-y-auto custom-scrollbar">
          <Grid
            key={`${activeTab}-${search}`}
            width={280}
            columns={2}
            fetchGifs={fetchGifs}
            onGifClick={(gif, e) => {
              e.preventDefault();
              onSelect(gif.images.fixed_height.url);
            }}
            noResultsMessage={`No ${activeTab} found`}
          />
        </div>
      </Tabs>
    </div>
  );
}
