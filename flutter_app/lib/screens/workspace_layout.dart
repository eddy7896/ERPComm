import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:ERPComm/models/workspace.dart';
import 'package:ERPComm/models/channel.dart';
import 'package:ERPComm/models/profile.dart';
import 'package:ERPComm/services/navigation_provider.dart';
import 'package:ERPComm/screens/chat_screen.dart';
import 'package:ERPComm/screens/create_channel_dialog.dart';
import 'package:ERPComm/screens/profile_settings_screen.dart';
import 'package:ERPComm/screens/status_picker.dart';
import 'package:ERPComm/screens/invite_user_dialog.dart';
import 'package:ERPComm/theme/shad_theme.dart';
import 'package:ERPComm/widgets/shad_avatar.dart';
import 'package:ERPComm/widgets/shad_badge.dart';

class WorkspaceLayout extends ConsumerStatefulWidget {
  final Workspace workspace;
  const WorkspaceLayout({super.key, required this.workspace});

  @override
  ConsumerState<WorkspaceLayout> createState() => _WorkspaceLayoutState();
}

class _WorkspaceLayoutState extends ConsumerState<WorkspaceLayout> {
  final _supabase = Supabase.instance.client;
  List<Channel> _channels = [];
  List<Profile> _members = [];
  Profile? _currentUserProfile;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final channelsResponse = await _supabase
          .from('channels')
          .select()
          .eq('workspace_id', widget.workspace.id);

      final membersResponse = await _supabase
          .from('workspace_members')
          .select('profiles (*)')
          .eq('workspace_id', widget.workspace.id);

      final myId = _supabase.auth.currentUser?.id;
      final profileResponse = await _supabase
          .from('profiles')
          .select()
          .eq('id', myId!)
          .single();

      setState(() {
        _channels = (channelsResponse as List).map((c) => Channel.fromJson(c)).toList();
        _members = (membersResponse as List)
            .map((m) => Profile.fromJson(m['profiles']))
            .where((p) => p.id != myId)
            .toList();
        _currentUserProfile = Profile.fromJson(profileResponse);
        
        if (_channels.isNotEmpty && ref.read(navigationProvider).channel == null && ref.read(navigationProvider).recipient == null) {
          ref.read(navigationProvider.notifier).selectChannel(_channels.first);
        }
        
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error fetching workspace data: $e');
      setState(() => _isLoading = false);
    }
  }

  Future<void> _updateStatus(String? text, String? emoji) async {
    try {
      final myId = _supabase.auth.currentUser?.id;
      await _supabase.from('profiles').update({
        'status_text': text,
        'status_emoji': emoji,
      }).eq('id', myId!);
      
      _fetchData(); 
    } catch (e) {
      debugPrint('Error updating status: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final nav = ref.watch(navigationProvider);
    final isMobile = MediaQuery.of(context).size.width < 768;

    Widget sidebar = _buildSidebar();

    return Scaffold(
      backgroundColor: ShadColors.background,
      appBar: isMobile
          ? AppBar(
              title: Text(nav.channel?.name ?? nav.recipient?.fullName ?? nav.recipient?.username ?? widget.workspace.name),
              leading: Builder(
                builder: (context) => IconButton(
                  icon: const Icon(Icons.menu),
                  onPressed: () => Scaffold.of(context).openDrawer(),
                ),
              ),
            )
          : null,
      drawer: isMobile ? Drawer(child: sidebar) : null,
      body: Row(
        children: [
          if (!isMobile)
            SizedBox(
              width: 260,
              child: sidebar,
            ),
          const VerticalDivider(width: 1, thickness: 1, color: ShadColors.border),
          Expanded(
            child: _buildMainContent(nav),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar() {
    return Container(
      color: const Color(0xFFf4f4f5).withOpacity(0.5), // zinc-100 equivalent
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSidebarHeader(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: ShadColors.mutedForeground))
                : ListView(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    children: [
                      _buildSectionHeader('Channels', onAdd: () {
                        showDialog(
                          context: context,
                          builder: (context) => CreateChannelDialog(
                            workspaceId: widget.workspace.id,
                            onCreated: _fetchData,
                          ),
                        );
                      }),
                      ..._channels.map((c) => _buildSidebarItem(
                            label: c.name,
                            icon: Icons.tag,
                            isSelected: ref.watch(navigationProvider).channel?.id == c.id,
                            onTap: () {
                              ref.read(navigationProvider.notifier).selectChannel(c);
                              if (Navigator.of(context).canPop()) Navigator.of(context).pop();
                            },
                          )),
                      const SizedBox(height: 20),
                      _buildSectionHeader('Direct Messages'),
                      ..._members.map((m) => _buildSidebarItem(
                            label: m.fullName ?? m.username ?? 'User',
                            icon: Icons.person_outline,
                            isSelected: ref.watch(navigationProvider).recipient?.id == m.id,
                            profile: m,
                            onTap: () {
                              ref.read(navigationProvider.notifier).selectDM(m);
                              if (Navigator.of(context).canPop()) Navigator.of(context).pop();
                            },
                          )),
                    ],
                  ),
          ),
          _buildCurrentUserSection(),
        ],
      ),
    );
  }

  Widget _buildSidebarHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: ShadColors.border)),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: ShadColors.primary,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Center(
              child: Text(
                widget.workspace.name[0].toUpperCase(),
                style: const TextStyle(color: ShadColors.primaryForeground, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              widget.workspace.name,
              style: const TextStyle(
                color: ShadColors.foreground,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.keyboard_arrow_down, size: 18, color: ShadColors.mutedForeground),
            onPressed: () {},
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, {VoidCallback? onAdd}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              color: ShadColors.mutedForeground,
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.1 * 12,
            ),
          ),
          if (onAdd != null)
            InkWell(
              onTap: onAdd,
              borderRadius: BorderRadius.circular(4),
              child: const Padding(
                padding: EdgeInsets.all(2),
                child: Icon(Icons.add, size: 16, color: ShadColors.mutedForeground),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSidebarItem({
    required String label,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
    Profile? profile,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? ShadColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              if (profile != null)
                Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: ShadAvatar(url: profile.avatarUrl, name: profile.fullName ?? profile.username ?? '?', size: 24),
                )
              else
                Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: Icon(icon, color: isSelected ? ShadColors.primaryForeground : ShadColors.mutedForeground, size: 18),
                ),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: isSelected ? ShadColors.primaryForeground : ShadColors.foreground.withOpacity(0.8),
                    fontSize: 14,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  ),
                ),
              ),
              if (profile?.badge != null)
                ShadBadge(label: profile!.badge!, variant: profile.badge),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentUserSection() {
    if (_currentUserProfile == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: ShadColors.border)),
      ),
      child: Row(
        children: [
          InkWell(
            onTap: () {
              showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                builder: (context) => StatusPicker(
                  currentText: _currentUserProfile?.statusText,
                  currentEmoji: _currentUserProfile?.statusEmoji,
                  onSave: _updateStatus,
                ),
              );
            },
            child: ShadAvatar(
              url: _currentUserProfile?.avatarUrl,
              name: _currentUserProfile?.fullName ?? _currentUserProfile?.username ?? '?',
              size: 36,
              isOnline: true,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _currentUserProfile?.fullName ?? _currentUserProfile?.username ?? 'User',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: ShadColors.foreground),
                  overflow: TextOverflow.ellipsis,
                ),
                if (_currentUserProfile?.statusText != null && _currentUserProfile!.statusText!.isNotEmpty)
                  Text(
                    '${_currentUserProfile?.statusEmoji ?? ''} ${_currentUserProfile!.statusText}',
                    style: const TextStyle(fontSize: 11, color: ShadColors.mutedForeground),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined, size: 18, color: ShadColors.mutedForeground),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => ProfileSettingsScreen(
                    profile: _currentUserProfile!,
                    onUpdate: _fetchData,
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMainContent(SelectedNavigation nav) {
    if (nav.channel != null) {
      return ChatScreen(channel: nav.channel!);
    } else if (nav.recipient != null) {
      return ChatScreen(recipient: nav.recipient!);
    } else {
      return const Center(child: Text('Select a channel or DM'));
    }
  }
}
