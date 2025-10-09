"use client";

import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const KVFormSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1, "Please enter a key."),
  value: z.string().min(1, "Please enter a value."),
});

export function AdminKeyValueCard() {
  const { data, refetch, isLoading } = api.kv.getAll.useQuery();

  const createMutation = api.kv.create.useMutation({
    onSuccess: () => {
      refetch();
      cancelEdit();
    },
  });

  const updateMutation = api.kv.update.useMutation({
    onSuccess: () => {
      refetch();
      cancelEdit();
    },
  });

  const deleteMutation = api.kv.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const form = useForm<z.infer<typeof KVFormSchema>>({
    resolver: zodResolver(KVFormSchema),
    defaultValues: { id: undefined, key: "", value: "" },
  });

  const onSubmit = (values: z.infer<typeof KVFormSchema>) => {
    if (values.id) {
      updateMutation.mutate({ id: values.id, key: values.key, value: values.value });
    } else {
      createMutation.mutate({ key: values.key, value: values.value });
    }
  };

  const startEdit = (id: string) => {
    const row = data?.find((kv) => kv.id === id);
    if (row) {
      form.reset({ id: row.id, key: row.key, value: row.value });
    }
  };

  const cancelEdit = () => {
    form.reset({ id: undefined, key: "", value: "" });
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const rows = (data ?? []).slice().sort((a, b) => a.key.localeCompare(b.key));

  return (
    <>
      <Card className="mb-6 p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-4 items-end flex-wrap">
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    <Input placeholder="app.setting" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem className="min-w-[320px]">
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input placeholder="value" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isMutating || !form.formState.isValid}>
              {form.getValues("id")
                ? isMutating
                  ? "Saving..."
                  : "Save Changes"
                : isMutating
                  ? "Adding..."
                  : "Add Entry"}
            </Button>
            {form.getValues("id") && (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </form>
        </Form>
      </Card>
      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-2">Key-Value Store</h2>
        <Table>
          <TableCaption>A list of all key-value entries.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-[220px]">Updated</TableHead>
              <TableHead className="w-[160px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>Loading...</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No entries found.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.key}</TableCell>
                  <TableCell className="max-w-[500px] break-words">{row.value}</TableCell>
                  <TableCell>
                    {row.updatedAt instanceof Date
                      ? row.updatedAt.toLocaleString()
                      : new Date(row.updatedAt as any).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(row.id)}
                        disabled={!!form.getValues("id")}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate({ id: row.id })}
                        disabled={deleteMutation.isPending || !!form.getValues("id")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

