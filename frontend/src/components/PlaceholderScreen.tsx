import { BookOpen, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function PlaceholderScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <Card className="relative w-full max-w-md shadow-lg shadow-primary/5">
        <CardHeader className="border-b border-border/60">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="size-5" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wide">
              Trailread
            </span>
          </div>
          <CardTitle className="mt-2 text-xl">UI stack ready</CardTitle>
          <CardDescription>
            Tailwind utilities and shadcn components are wired up. Replace this
            screen when you start building routes.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <p className="text-muted-foreground">
            If you see styled typography, borders, and buttons here,{' '}
            <span className="font-medium text-foreground">CSS variables</span>{' '}
            and{' '}
            <span className="font-medium text-foreground">Tailwind</span> are
            working.
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>Card uses shadcn token classes (`bg-card`, `ring-1`, …)</li>
            <li>Background uses solid design tokens for a quieter surface.</li>
          </ul>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button">
            <BookOpen className="size-4" aria-hidden />
            Primary action
          </Button>
          <Button type="button" variant="outline">
            Outline
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
