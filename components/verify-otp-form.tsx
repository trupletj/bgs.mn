'use client'
import { redirect, useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { createClient } from '@/utils/supabase/client'
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
// interface Props { register: string; phone: string }
const FormSchema = z.object({
    pin: z.string().min(6, {
        message: "Нэвтрэх код 6 оронтой байх ёстой.",
    }),
})

export function VerifyOtpForm() {
    const supabase = createClient()
    const router = useRouter()
    const searchParams = useSearchParams()
    const register = searchParams.get('register') || ''
    const phone = searchParams.get('phone') || ''

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            pin: "",
        },
    })

    async function onSubmit(data: z.infer<typeof FormSchema>) {
        const { data : resData, error } = await supabase.auth.verifyOtp({ phone, token: data.pin, type : "sms" });
        if (error) {
            toast(JSON.stringify(error, null, 2))

        } else {
            toast(JSON.stringify(resData, null, 2))
            redirect('/dashboard')
        }
    }

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
                    <FormField
                        control={form.control}
                        name="pin"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>One-Time Password</FormLabel>
                                <FormControl>
                                    <InputOTP maxLength={6} {...field}>
                                        <InputOTPGroup>
                                            <InputOTPSlot index={0} />
                                            <InputOTPSlot index={1} />
                                            <InputOTPSlot index={2} />
                                            <InputOTPSlot index={3} />
                                            <InputOTPSlot index={4} />
                                            <InputOTPSlot index={5} />
                                        </InputOTPGroup>
                                    </InputOTP>
                                </FormControl>
                                <FormDescription>
                                    Утсанд ирсэн нэг удаагын кодоо оруулна уу.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button type="submit">Submit</Button>
                </form>
            </Form>

        </>
    )
}