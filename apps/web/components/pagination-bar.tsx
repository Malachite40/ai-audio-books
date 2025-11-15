import { Label } from "@workspace/ui/components/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@workspace/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { useId } from "react";

export interface PaginationBarProps {
  page: number;
  totalPages: number;
  pages: number[];
  showLeftEllipsis: boolean;
  showRightEllipsis: boolean;
  setPage: (page: number) => void;
  pageSizeOptions?: number[];
  pageSize?: number;
  totalItems?: number;
  onPageSizeChange?: (size: number) => void;
}

export function PaginationBar({
  page,
  totalPages,
  pages,
  showLeftEllipsis,
  showRightEllipsis,
  setPage,
  pageSizeOptions = [10, 25, 50, 100],
  pageSize,
  totalItems,
  onPageSizeChange,
}: PaginationBarProps) {
  const id = useId();

  const effectivePageSize =
    pageSize && pageSize > 0 ? pageSize : pageSizeOptions[0]!;

  const hasRangeInfo =
    typeof totalItems === "number" && totalItems >= 0 && effectivePageSize > 0;
  const totalCount = hasRangeInfo ? (totalItems ?? 0) : 0;
  const startItem =
    hasRangeInfo && totalCount > 0 ? (page - 1) * effectivePageSize + 1 : 0;
  const endItem =
    hasRangeInfo && totalCount > 0
      ? Math.min(totalCount, page * effectivePageSize)
      : 0;

  const handlePageSizeChange = (value: string) => {
    const nextSize = Number(value);
    if (!Number.isNaN(nextSize) && nextSize > 0) {
      onPageSizeChange?.(nextSize);
    }
  };

  return (
    <div className="flex items-center justify-between gap-8 px-8 pb-4">
      <div className="flex items-center gap-4">
        {/* Results per page */}
        {onPageSizeChange && (
          <div className="flex items-center gap-3">
            <Label htmlFor={id}>Rows per page</Label>
            <Select
              value={String(effectivePageSize)}
              onValueChange={handlePageSizeChange}
              disabled={!onPageSizeChange}
            >
              <SelectTrigger id={id} className="w-fit whitespace-nowrap">
                <SelectValue placeholder="Select number of results" />
              </SelectTrigger>
              <SelectContent className="[&_*[role=option]]:ps-2 [&_*[role=option]]:pe-8 [&_*[role=option]>span]:start-auto [&_*[role=option]>span]:end-2">
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Page number information */}
        <div className="flex justify-end text-sm whitespace-nowrap text-muted-foreground">
          <p
            className="text-sm whitespace-nowrap text-muted-foreground"
            aria-live="polite"
          >
            {hasRangeInfo ? (
              <>
                <span className="text-foreground">
                  {startItem}-{endItem}
                </span>{" "}
                of <span className="text-foreground">{totalCount}</span>
              </>
            ) : (
              <>
                Page <span className="text-foreground">{page}</span> of{" "}
                <span className="text-foreground">{totalPages}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Pagination controls */}
      <div>
        <Pagination>
          <PaginationContent>
            {/* First page button */}
            <PaginationItem>
              <PaginationLink
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                href={page === 1 ? undefined : "#"}
                aria-label="Go to first page"
                aria-disabled={page === 1 ? true : undefined}
                role={page === 1 ? "link" : undefined}
                onClick={(event) => {
                  if (page === 1) return;
                  event.preventDefault();
                  setPage(1);
                }}
              >
                <ChevronFirstIcon size={16} aria-hidden="true" />
              </PaginationLink>
            </PaginationItem>

            {/* Previous page button */}
            <PaginationItem>
              <PaginationLink
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                href={page === 1 ? undefined : "#"}
                aria-label="Go to previous page"
                aria-disabled={page === 1 ? true : undefined}
                role={page === 1 ? "link" : undefined}
                onClick={(event) => {
                  if (page === 1) return;
                  event.preventDefault();
                  setPage(page - 1);
                }}
              >
                <ChevronLeftIcon size={16} aria-hidden="true" />
              </PaginationLink>
            </PaginationItem>
            {/* Next page button */}
            <PaginationItem>
              <PaginationLink
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                href={page >= totalPages ? undefined : "#"}
                aria-label="Go to next page"
                aria-disabled={page >= totalPages ? true : undefined}
                role={page >= totalPages ? "link" : undefined}
                onClick={(event) => {
                  if (page >= totalPages) return;
                  event.preventDefault();
                  setPage(page + 1);
                }}
              >
                <ChevronRightIcon size={16} aria-hidden="true" />
              </PaginationLink>
            </PaginationItem>

            {/* Last page button */}
            <PaginationItem>
              <PaginationLink
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                href={page >= totalPages ? undefined : "#"}
                aria-label="Go to last page"
                aria-disabled={page >= totalPages ? true : undefined}
                role={page >= totalPages ? "link" : undefined}
                onClick={(event) => {
                  if (page >= totalPages) return;
                  event.preventDefault();
                  setPage(totalPages);
                }}
              >
                <ChevronLastIcon size={16} aria-hidden="true" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
