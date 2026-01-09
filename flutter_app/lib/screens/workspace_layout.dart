import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_app/models/workspace.dart';
import 'package:flutter_app/models/channel.dart';
import 'package:flutter_app/models/profile.dart';
import 'package:flutter_app/services/navigation_provider.dart';
import 'package:flutter_app/screens/chat_screen.dart';
import 'package:flutter_app/screens/create_channel_dialog.dart';
import 'package:flutter_app/screens/profile_settings_screen.dart';
import 'package:flutter_app/screens/status_picker.dart';
import 'package:flutter_app/screens/invite_user_dialog.dart';

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
        
        // Select first channel by default if nothing selected
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
      
      _fetchData(); // Refresh profile
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
      backgroundColor: Colors.white,
      appBar: isMobile
          ? AppBar(
              title: Text(nav.channel?.name ?? nav.recipient?.fullName ?? nav.recipient?.username ?? widget.workspace.name),
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
          const VerticalDivider(width: 1, thickness: 1, color: Color(0xFFe4e4e7)),
          Expanded(
            child: _buildMainContent(nav),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar() {
    return Container(
      color: const Color(0xFFf8f8f8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSidebarHeader(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.black54))
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
                            onTap: () => ref.read(navigationProvider.notifier).selectChannel(c),
                          )),
                      const SizedBox(height: 20),
                      _buildSectionHeader('Direct Messages'),
                      ..._members.map((m) => _buildSidebarItem(
                            label: m.fullName ?? m.username ?? 'User',
                            icon: Icons.person_outline,
                            isSelected: ref.watch(navigationProvider).recipient?.id == m.id,
                            onTap: () => ref.read(navigationProvider.notifier).selectDM(m),
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
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFe4e4e7))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              widget.workspace.name,
              style: const TextStyle(
                color: Color(0xFF09090b),
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.person_add_outlined, size: 18, color: Colors.black54),
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => InviteUserDialog(
                  workspaceId: widget.workspace.id,
                  workspaceSlug: widget.workspace.slug,
                ),
              );
            },
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            visualDensity: VisualDensity.compact,
          ),
          const SizedBox(width: 8),
          const Icon(Icons.keyboard_arrow_down, color: Colors.black54),
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
              color: Colors.black54,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
          if (onAdd != null)
            IconButton(
              icon: const Icon(Icons.add, size: 16, color: Colors.black54),
              onPressed: onAdd,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              visualDensity: VisualDensity.compact,
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
  }) {
    return ListTile(
      onTap: onTap,
      dense: true,
      visualDensity: VisualDensity.compact,
      selected: isSelected,
      selectedTileColor: const Color(0xFFe4e4e7),
      leading: Icon(icon, color: isSelected ? const Color(0xFF09090b) : Colors.black54, size: 18),
      title: Text(
        label,
        style: TextStyle(
          color: isSelected ? const Color(0xFF09090b) : Colors.black87,
          fontSize: 15,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
        ),
      ),
    );
  }

  Widget _buildCurrentUserSection() {
    if (_currentUserProfile == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Color(0xFFe4e4e7))),
      ),
      child: InkWell(
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
        child: Row(
          children: [
            Stack(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundImage: _currentUserProfile?.avatarUrl != null 
                    ? NetworkImage(_currentUserProfile!.avatarUrl!) 
                    : null,
                  child: _currentUserProfile?.avatarUrl == null 
                    ? Text(_currentUserProfile?.fullName?[0] ?? _currentUserProfile?.username?[0] ?? 'U') 
                    : null,
                ),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: Colors.green,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _currentUserProfile?.fullName ?? _currentUserProfile?.username ?? 'User',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (_currentUserProfile?.statusText != null && _currentUserProfile!.statusText!.isNotEmpty)
                    Text(
                      '${_currentUserProfile?.statusEmoji ?? ''} ${_currentUserProfile!.statusText}',
                      style: const TextStyle(fontSize: 11, color: Colors.black54),
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.settings_outlined, size: 20, color: Colors.black54),
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
