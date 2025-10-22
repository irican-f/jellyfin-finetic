"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Users,
    Plus,
    LogIn,
    LogOut,
    RefreshCw,
    Wifi,
    WifiOff,
    Loader2,
    AlertCircle,
    CheckCircle,
    Clock,
} from "lucide-react";
import { useSyncPlay } from "@/contexts/SyncPlayContext";
import { toast } from "sonner";
import { GroupInfoDto } from '@jellyfin/sdk/lib/generated-client';

interface SyncPlayDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SyncPlayDialog({ open, onOpenChange }: SyncPlayDialogProps) {
    const {
        currentGroup,
        isEnabled,
        connectionStatus,
        availableGroups,
        isLoading,
        error,
        listGroups,
        createGroup,
        joinGroup,
        leaveGroup,
        refreshGroups,
        syncManually,
    } = useSyncPlay();

    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    // Load groups when dialog opens
    useEffect(() => {
        if (open) {
            listGroups();
        } else {
            // Clear input when dialog closes
            setNewGroupName("");
        }
    }, [open, listGroups]);

    const handleCreateGroup = async () => {
        setIsCreatingGroup(true);
        try {
            const groupName = newGroupName.trim() || "SyncPlay Group";
            await createGroup(groupName);
            setNewGroupName(""); // Clear input after successful creation
        } catch (error) {
            console.log(error);
        } finally {
            setIsCreatingGroup(false);
        }
    };

    const handleJoinGroup = async (groupId: string) => {
        try {
            await joinGroup(groupId);
            // Refresh groups to update the UI
            await refreshGroups();
        } catch (error) {
            console.error("Failed to join group:", error);
        }
    };

    const handleLeaveGroup = async () => {
        try {
            await leaveGroup();
        } catch (error) {
            console.error("Failed to leave group:", error);
        }
    };

    const handleSyncNow = () => {
        syncManually();
    };

    const getConnectionStatusIcon = () => {
        switch (connectionStatus) {
            case "connected":
                return <Wifi className="h-4 w-4 text-green-500" />;
            case "connecting":
                return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
            case "disconnected":
                return <WifiOff className="h-4 w-4 text-red-500" />;
            default:
                return <WifiOff className="h-4 w-4 text-gray-500" />;
        }
    };

    const getConnectionStatusText = () => {
        switch (connectionStatus) {
            case "connected":
                return "Connected";
            case "connecting":
                return "Connecting...";
            case "disconnected":
                return "Disconnected";
            default:
                return "Unknown";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            SyncPlay
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refreshGroups}
                            disabled={isLoading}
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </DialogTitle>
                    <DialogDescription>
                        Synchronize playback with other users in real-time
                    </DialogDescription>
                </DialogHeader>

                {/* Connection Status */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                        {getConnectionStatusIcon()}
                        <span className="text-sm font-medium">
                            {getConnectionStatusText()}
                        </span>
                    </div>
                    {error && (
                        <div className="flex items-center gap-1 text-red-500 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {isEnabled && currentGroup ? (
                    /* In Group View */
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>{currentGroup.GroupName}</span>
                                    <Badge variant="secondary">
                                        {currentGroup.Participants?.length || 0} member{(currentGroup.Participants?.length || 0) !== 1 ? 's' : ''}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    Group ID: {currentGroup.GroupId}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Status:</span>
                                        <Badge variant={currentGroup.IsPaused ? "destructive" : "default"}>
                                            {currentGroup.IsPaused ? "Paused" : "Playing"}
                                        </Badge>
                                    </div>

                                    {currentGroup.PlayingItemId && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">Playing:</span>
                                            <span className="text-sm text-muted-foreground">
                                                Item ID: {currentGroup.PlayingItemId}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button onClick={handleSyncNow} variant="outline" size="sm">
                                            <RefreshCw className="h-4 w-4 mr-1" />
                                            Sync Now
                                        </Button>
                                        <Button onClick={handleLeaveGroup} variant="destructive" size="sm">
                                            <LogOut className="h-4 w-4 mr-1" />
                                            Leave Group
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Participants */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Participants</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-32">
                                    <div className="space-y-2">
                                        {currentGroup.Participants?.map((participant) => (
                                            <div
                                                key={participant}
                                                className="flex items-center justify-between p-2 bg-muted rounded"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4" />
                                                    <span className="text-sm font-medium">
                                                        {participant}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    /* Not in Group View */
                    <div className="space-y-4">
                        {/* Create New Group */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Create New Group</CardTitle>
                                <CardDescription>
                                    Start a new SyncPlay session
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="group-name" className="text-sm font-medium">
                                        Group Name (Optional)
                                    </Label>
                                    <Input
                                        id="group-name"
                                        type="text"
                                        placeholder="SyncPlay Group"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        disabled={isCreatingGroup}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Leave empty to use default name
                                    </p>
                                </div>
                                <Button
                                    onClick={handleCreateGroup}
                                    disabled={isCreatingGroup}
                                    className="w-full"
                                >
                                    {isCreatingGroup ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4 mr-2" />
                                    )}
                                    Create Group
                                </Button>
                            </CardContent>
                        </Card>

                        <Separator />

                        {/* Available Groups */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Available Groups</CardTitle>
                                <CardDescription>
                                    Join an existing SyncPlay session
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        <span className="ml-2">Loading groups...</span>
                                    </div>
                                ) : availableGroups.length > 0 ? (
                                    <ScrollArea className="h-48">
                                        <div className="space-y-2">
                                            {availableGroups.map((group) => (
                                                <div
                                                    key={group.GroupId}
                                                    className="flex items-center justify-between p-3 bg-muted rounded"
                                                >
                                                    <div>
                                                        <div className="font-medium">{group.GroupName}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {group.Participants?.length || 0} member{(group.Participants?.length || 0) !== 1 ? 's' : ''}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        onClick={() => handleJoinGroup(group.GroupId!)}
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        <LogIn className="h-4 w-4 mr-1" />
                                                        Join
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>No groups available</p>
                                        <p className="text-sm">Create a new group to get started</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
