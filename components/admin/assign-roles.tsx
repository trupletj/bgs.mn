"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { getProfileIdFromAuthUserId } from "@/actions/profile";

interface Profile {
  id: number;
  name: string;
  email: string;
  phone: string;
  position_name: string;
  department_name: string;
  auth_user_id: string;
}

interface Role {
  id: number;
  name: string;
  display_name: string;
}

interface ProfileWithRoles extends Profile {
  roles: Role[];
}

export function AssignRoles() {
  const [profiles, setProfiles] = useState<ProfileWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [assigning, setAssigning] = useState<number | null>(null);

  const supabase = createClient();

  // Өгөгдлийг авах
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Profile болон Role-уудыг авах
      const [profilesResponse, rolesResponse] = await Promise.all([
        supabase.from("profile").select("*").order("name"),
        supabase.from("roles").select("*").order("display_name"),
      ]);

      if (profilesResponse.error) throw profilesResponse.error;
      if (rolesResponse.error) throw rolesResponse.error;

      const profilesData = profilesResponse.data || [];
      const rolesData = rolesResponse.data || [];

      // Profile бүрийн roles-г авах
      const profilesWithRoles = await Promise.all(
        profilesData.map(async (profile) => {
          const { data: rolesProfiles } = await supabase
            .from("roles_profiles")
            .select(
              `
              roles (
                id,
                name,
                display_name
              )
            `,
            )
            .eq("profile_id", profile.id);

          return {
            ...profile,
            roles: rolesProfiles?.map((rp) => rp.roles) || [],
          };
        }),
      );

      setProfiles(profilesWithRoles);
      setRoles(rolesData);
    } catch (error) {
      toast.error("Өгөгдөл авахад алдаа гарлаа");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Role оноох
  const assignRole = async (profileId: number, roleId: number) => {
    try {
      setAssigning(profileId);

      const { profile_id } = await getProfileIdFromAuthUserId();

      const { error } = await supabase.from("roles_profiles").insert({
        profile_id: profileId,
        role_id: roleId,
        assigned_by: profile_id,
      });

      if (error) throw error;

      toast.success("Role амжилттай оноогдлоо");
      fetchData(); // Жагсаалтыг шинэчлэх
    } catch (error) {
      toast.error("Role онооход алдаа гарлаа");
      console.error(error);
    } finally {
      setAssigning(null);
    }
  };

  // Role хасах
  const removeRole = async (profileId: number, roleId: number) => {
    try {
      setAssigning(profileId);

      // roles_profiles хүснэгтээс устгах
      const { error } = await supabase
        .from("roles_profiles")
        .delete()
        .eq("profile_id", profileId)
        .eq("role_id", roleId);

      if (error) throw error;

      toast.success("Role амжилттай устгагдлаа");
      fetchData(); // Жагсаалтыг шинэчлэх
    } catch (error) {
      toast.error("Role устгахад алдаа гарлаа");
      console.error(error);
    } finally {
      setAssigning(null);
    }
  };

  // Хайлт хийсэн profile-ууд
  const filteredProfiles = profiles.filter(
    (profile) => profile.name.toLowerCase().includes(searchTerm.toLowerCase()),
    // profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    // profile.department_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Ачаалж байна...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile-уудад Role Оноох</CardTitle>
        <CardDescription>
          Хэрэглэгчдийн profile-уудад role-ууд оноох. Нэг хүн хэдэн ч role-тэй
          байж болно.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Хайлтын хэсэг */}
        <div className="mb-6">
          <Input
            placeholder="Хайлт хийх..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Profile-уудын жагсаалт */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="">
                <TableHead className="font-bold">Нэр</TableHead>
                {/* <TableHead>Имэйл</TableHead> */}
                {/* <TableHead>Хэлтэс</TableHead> */}
                {/* <TableHead>Албан тушаал</TableHead> */}
                <TableHead className="font-bold">Одоогийн Role-ууд</TableHead>
                <TableHead className="font-bold">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.name}</TableCell>
                  {/* <TableCell>{profile.email}</TableCell> */}
                  {/* <TableCell>{profile.department_name}</TableCell> */}
                  {/* <TableCell>{profile.position_name}</TableCell> */}

                  {/* Role-ууд */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {profile.roles.map((role) => (
                        <Badge
                          key={role.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-red-100"
                          onClick={() => removeRole(profile.id, role.id)}>
                          {role.display_name} ×
                        </Badge>
                      ))}
                      {profile.roles.length === 0 && (
                        <span className="text-sm text-muted-foreground">
                          Role байхгүй
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Role оноох */}
                  <TableCell>
                    <Select
                      onValueChange={(roleId) =>
                        assignRole(profile.id, parseInt(roleId))
                      }
                      disabled={assigning === profile.id}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Role нэмэх" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredProfiles.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              {searchTerm
                ? "Хайлтад тохирох profile олдсонгүй"
                : "Profile байхгүй байна"}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
