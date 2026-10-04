"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { languageOptions, type AppLocale } from "@/i18n/config";
import { policyKinds, policyLabels, type PolicyKind, type PolicyContentInput, type PolicyContentRecord } from "@/lib/policy-content";

const blank = (kind: PolicyKind, locale: AppLocale): PolicyContentInput => ({ kind, locale, title: "", content: "", category: "", linkUrl: null, sortOrder: 0, isPublished: false, effectiveDate: null });

export default function PolicyManager() {
  const [kind, setKind] = useState<PolicyKind>("shipping");
  const [locale, setLocale] = useState<AppLocale>("en");
  const [records, setRecords] = useState<PolicyContentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyContentInput>(blank("shipping", "en"));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<PolicyContentRecord | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/policies", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRecords(data);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Failed to load content"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  function edit(record?: PolicyContentRecord) {
    setEditingId(record?.id ?? null);
    setForm(record ? {
      kind: record.kind, locale: record.locale, title: record.title, content: record.content,
      category: record.category, linkUrl: record.linkUrl, sortOrder: record.sortOrder,
      isPublished: record.isPublished, effectiveDate: record.effectiveDate?.slice(0, 10) ?? null,
    } : { ...blank(kind, locale), sortOrder: Math.max(-1, ...records.filter(r => r.kind === kind && r.locale === locale).map(r => r.sortOrder)) + 1 });
    setEditorOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/admin/policies/${editingId}` : "/api/admin/policies", {
        method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEditorOpen(false);
      toast.success(editingId ? "Content updated" : "Content created");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to save content"); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/policies/${deleting.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDeleting(null);
      toast.success("Content deleted");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to delete content"); }
    finally { setSaving(false); }
  }

  const visible = records.filter(r => r.kind === kind && r.locale === locale && `${r.title} ${r.content} ${r.category}`.toLowerCase().includes(search.toLowerCase()));
  const isFaq = kind === "faq";
  const isSitemap = kind === "sitemap";
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="flex items-center gap-3 text-2xl font-bold"><FileText className="h-6 w-6 text-primary" />Policy Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage storefront policies, customer questions and sitemap links.</p></div>
        <Button asChild variant="outline"><Link href={`/ecommerce/${kind}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />View page</Link></Button>
      </div>
      <Tabs value={kind} onValueChange={value => { setKind(value as PolicyKind); setSearch(""); }}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">{policyKinds.map(key => <TabsTrigger key={key} value={key} className="px-4 py-2">{policyLabels[key]}</TabsTrigger>)}</TabsList>
      <TabsContent value={kind} className="mt-6 rounded-xl border bg-card p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">{policyLabels[kind]}</h2><p className="text-sm text-muted-foreground">{visible.length} entries · Published content appears on the storefront.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="policy-language" className="sr-only">Language</label>
            <select id="policy-language" value={locale} onChange={e => setLocale(e.target.value as AppLocale)} className="h-10 rounded-md border bg-background px-3 text-sm">{languageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <Button onClick={() => edit()} disabled={loading || !!loadError}><Plus className="mr-2 h-4 w-4" />{isFaq ? "Add question" : isSitemap ? "Add link" : "Add section"}</Button>
          </div>
        </div>
        <Input aria-label="Search content" placeholder="Search title or content…" value={search} onChange={e => setSearch(e.target.value)} className="mb-5 max-w-md" />
        {loading ? <p role="status" className="py-12 text-center text-muted-foreground">Loading content…</p> : loadError ? <div role="alert" className="py-8 text-center"><p>{loadError}</p><Button variant="outline" onClick={() => void load()} className="mt-3">Retry</Button></div> : !visible.length ? <div className="py-12 text-center text-muted-foreground">No entries found. Add content to this tab and language.</div> :
          <div className="divide-y">{visible.map(record => <article key={record.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{record.title}</h3><span className={`rounded-full px-2 py-1 text-xs ${record.isPublished ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{record.isPublished ? "Published" : "Draft"}</span></div>
              <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{record.content || record.linkUrl}</p>
              <p className="mt-3 text-xs text-muted-foreground">Order: {record.sortOrder}{record.category && ` · ${record.category}`} · Updated: {new Date(record.updatedAt).toLocaleDateString()}{record.effectiveDate && ` · Effective: ${record.effectiveDate.slice(0, 10)}`}</p></div>
            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => edit(record)}><Pencil className="mr-1 h-4 w-4" />Edit</Button><Button variant="outline" size="sm" onClick={() => setDeleting(record)} aria-label={`Delete ${record.title}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
          </article>)}</div>}
      </TabsContent>
      </Tabs>
      <Dialog open={editorOpen} onOpenChange={open => { if (!saving) setEditorOpen(open); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editingId ? "Edit" : "Add"} {policyLabels[form.kind]}</DialogTitle><DialogDescription>Write plain text in the selected language. Publish when ready to display it to customers.</DialogDescription></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div><label htmlFor="policy-title" className="mb-1 block text-sm font-medium">{isFaq ? "Question" : isSitemap ? "Link title" : "Section title"}</label><Input id="policy-title" required maxLength={250} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label htmlFor="policy-content" className="mb-1 block text-sm font-medium">{isFaq ? "Answer" : isSitemap ? "Description (optional)" : "Content"}</label><Textarea id="policy-content" required={!isSitemap} rows={10} maxLength={100000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Line breaks are preserved. HTML is displayed as text.</p></div>
            {isSitemap && <div><label htmlFor="policy-url" className="mb-1 block text-sm font-medium">Storefront link</label><Input id="policy-url" required placeholder="/ecommerce/products" value={form.linkUrl ?? ""} onChange={e => setForm({ ...form, linkUrl: e.target.value })} /></div>}
            <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="policy-category" className="mb-1 block text-sm font-medium">Category (optional)</label><Input id="policy-category" maxLength={100} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div><div><label htmlFor="policy-order" className="mb-1 block text-sm font-medium">Display order</label><Input id="policy-order" type="number" min={0} max={100000} required value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div></div>
            <div><label htmlFor="policy-date" className="mb-1 block text-sm font-medium">Effective date (optional)</label><Input id="policy-date" type="date" value={form.effectiveDate ?? ""} onChange={e => setForm({ ...form, effectiveDate: e.target.value || null })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={e => setForm({ ...form, isPublished: e.target.checked })} />Published on storefront</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save content"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleting} onOpenChange={open => { if (!open && !saving) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this entry?</AlertDialogTitle><AlertDialogDescription>“{deleting?.title}” will be permanently removed from the database and storefront.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={e => { e.preventDefault(); void remove(); }}>{saving ? "Deleting…" : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
