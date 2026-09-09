"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Edit3, Loader2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Party = {
  id: number;
  name: string;
  image: string | null;
  bookCount?: number;
};

export default function BookPartyManager({
  kind,
}: {
  kind: "writers" | "publishers";
}) {
  const singular = kind === "writers" ? "Writer" : "Publisher";
  const [items, setItems] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/${kind}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to load ${kind}.`);
      setItems(Array.isArray(payload) ? payload : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to load ${kind}.`);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setImage("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/${kind}/${editing.id}` : `/api/${kind}`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image: image || null }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to save ${singular.toLowerCase()}.`);
      toast.success(`${singular} ${editing ? "updated" : "created"}.`);
      resetForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to save ${singular.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Party) => {
    if (!window.confirm(`Archive ${item.name}? Existing book history will be preserved.`)) return;
    const response = await fetch(`/api/${kind}/${item.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(payload?.error || `Failed to archive ${singular.toLowerCase()}.`);
      return;
    }
    toast.success(`${singular} archived.`);
    if (editing?.id === item.id) resetForm();
    await load();
  };

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{editing ? `Edit ${singular}` : `Add ${singular}`}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor={`${kind}-name`}>Name</Label>
                <Input id={`${kind}-name`} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${kind}-image`}>Image URL or path</Label>
                <Input id={`${kind}-image`} value={image} onChange={(event) => setImage(event.target.value)} maxLength={2048} placeholder="/uploads/..." />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editing ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                  {editing ? "Save" : "Create"}
                </Button>
                {editing ? <Button type="button" variant="outline" onClick={resetForm}><X className="mr-2 h-4 w-4" />Cancel</Button> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{kind === "writers" ? "Writers" : "Publishers"}</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loading && items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No {kind} yet.</p>
            ) : (
              <ul className="divide-y" aria-label={kind}>
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
                      {item.image ? <Image src={item.image} alt="" fill sizes="44px" className="object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.bookCount ?? 0} linked book(s)</p>
                    </div>
                    <Button type="button" size="icon" variant="ghost" aria-label={`Edit ${item.name}`} onClick={() => { setEditing(item); setName(item.name); setImage(item.image ?? ""); }}><Edit3 className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="text-destructive" aria-label={`Archive ${item.name}`} onClick={() => void remove(item)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
