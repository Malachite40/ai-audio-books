import { Button } from "@workspace/ui/components/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@workspace/ui/components/pagination";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export interface PaginationBarProps {
  page: number;
  totalPages: number;
  pages: number[];
  showLeftEllipsis: boolean;
  showRightEllipsis: boolean;
  setPage: (page: number) => void;
}

export function PaginationBar({
  page,
  totalPages,
  pages,
  showLeftEllipsis,
  showRightEllipsis,
  setPage,
}: PaginationBarProps) {
  return (
    <div className="flex flex-col-reverse items-center justify-between gap-3 px-8 pb-4 sm:flex-row">
      <p className="flex-1 whitespace-nowrap text-sm text-muted-foreground">
        Page <span className="text-foreground">{page}</span> of{" "}
        <span className="text-foreground">{totalPages}</span>
      </p>
      <div className="grow">
        <Pagination>
          <PaginationContent>
            {/* Previous page button */}
            <PaginationItem>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                aria-label="Go to previous page"
              >
                <ChevronLeftIcon size={16} aria-hidden="true" />
              </Button>
            </PaginationItem>
            {/* Left ellipsis */}
            {showLeftEllipsis && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            {/* Page number buttons */}
            {pages.map((p) => {
              const isActive = p === page;
              return (
                <PaginationItem key={p}>
                  <Button
                    size="icon"
                    variant={isActive ? "outline" : "ghost"}
                    onClick={() => setPage(p)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {p}
                  </Button>
                </PaginationItem>
              );
            })}
            {/* Right ellipsis */}
            {showRightEllipsis && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            {/* Next page button */}
            <PaginationItem>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                aria-label="Go to next page"
              >
                <ChevronRightIcon size={16} aria-hidden="true" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
      <div className="grow"></div>
    </div>
  );
}
