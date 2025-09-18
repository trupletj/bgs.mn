'use client'
import { useState } from 'react'
// import { signIn } from 'next-auth/react'
// import { matchUserInfo } from '@repo/actions'
import { redirect } from 'next/navigation'

import {createClient} from '@/utils/supabase/client'

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from 'next/image'

export  function RequestOtpForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
const supabase = createClient()
  // const { error : otpError } = await supabase.auth.signInWithOtp({ phone: "99135213" });
  const [register, setReg] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string>()

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    const { data, error } = await supabase.auth.signInWithOtp({
          phone , options : {
            shouldCreateUser : true , data : { register_number : register}
          }
        });
    if(error){ setError(JSON.stringify(error)); return }
    redirect(`/otp?phone=${phone}&register=${register}`)
  }


  return (
    <>
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="overflow-hidden">
          <CardContent className="grid p-0 md:grid-cols-2">
            <form className="p-6 md:p-8" onSubmit={onRequest}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold mb-2">Тавтай морил</h1>
                  <p className="text-balance text-sm text-muted-foreground">
                    Регистрийн дугаар болон утасны дугаараа ашиглан нэвтэрнэ үү
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Регистрийн дугаар</Label>
                  <Input
                    value={register}
                    onChange={e => setReg(e.target.value)}
                    type="text"
                    placeholder="АА00000000"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="phone">Утасны дугаар</Label>

                  </div>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} type="text" required />
                </div>
                {error && <p className="text-red-500">{error}</p>}
                <Button type="submit" className="w-full">
                  Нэвтрэх
                </Button>

              </div>
            </form>
            <div className='flex p-5'>
              <div className="relative w-full hidden md:block ">
                <Image
                  src="/building.svg"
                  alt="Image"
                  style={{ objectFit: "contain" }}
                  fill
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
          By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
          and <a href="#">Privacy Policy</a>.
        </div>
      </div>  
    </>
  )
}