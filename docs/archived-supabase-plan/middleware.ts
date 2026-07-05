import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // Define public and auth routes
  const isAuthRoute = url.pathname.startsWith('/login')
  const isPublicRoute = url.pathname === '/' || isAuthRoute

  // Protect all routes except public and auth pages
  if (!user && !isPublicRoute) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from auth pages
  if (user && isAuthRoute) {
    // Get user role from metadata or default to student
    const role = user.user_metadata?.role || 'student'
    url.pathname = `/${role}/dashboard`
    return NextResponse.redirect(url)
  }

  // Role-based route guard
  if (user && !isPublicRoute) {
    const role = user.user_metadata?.role || 'student'
    
    // Define role-specific route prefixes
    const rolePrefixes = [
      'student',
      'librarian',
      'accountant',
      'osa_coordinator',
      'guidance_counselor',
      'area_chair',
      'adviser',
      'dean',
      'admin',
    ]

    // Check if user is trying to access another role's routes
    for (const prefix of rolePrefixes) {
      if (url.pathname.startsWith(`/${prefix}`) && role !== prefix) {
        // Unauthorized role access, redirect to their own dashboard
        url.pathname = `/${role}/dashboard`
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
