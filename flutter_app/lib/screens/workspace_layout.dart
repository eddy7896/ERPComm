import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_app/models/workspace.dart';
import 'package:flutter_app/models/channel.dart';
import 'package:flutter_app/models/profile.dart';
import 'package:flutter_app/services/navigation_provider.dart';
import 'package:flutter_app/screens/chat_screen.dart';

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

      setState(() {
        _channels = (channelsResponse as List).map((c) => Channel.fromJson(c)).toList();
        _members = (membersResponse as List)
            .map((m) => Profile.fromJson(m['profiles']))
            .where((p) => p.id != _supabase.auth.currentUser?.id)
            .toList();
        
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

  @override
  Widget build(BuildContext context) {
    final nav = ref.watch(navigationProvider);
    final isMobile = MediaQuery.of(context).size.width < 768;

    Widget sidebar = _buildSidebar();

    return Scaffold(
      appBar: isMobile
          ? AppBar(
              title: Text(nav.channel?.name ?? nav.recipient?.fullName ?? nav.recipient?.username ?? widget.workspace.name),
              backgroundColor: const Color(0xFF611f69),
              foregroundColor: Colors.white,
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
          const VerticalDivider(width: 1, thickness: 1),
          Expanded(
            child: _buildMainContent(nav),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar() {
    return Container(
      color: const Color(0xFF3F0E40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSidebarHeader(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.white70))
                : ListView(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    children: [
                      _buildSectionHeader('Channels'),
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
        ],
      ),
    );
  }

  Widget _buildSidebarHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Colors.white12)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              widget.workspace.name,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const Icon(Icons.keyboard_arrow_down, color: Colors.white70),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          color: Colors.white54,
          fontSize: 12,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildSidebarItem({
    required String label,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: isSelected ? const Color(0xFF1164A3) : Colors.transparent,
      child: ListTile(
        onTap: onTap,
        dense: true,
        visualDensity: VisualDensity.compact,
        leading: Icon(icon, color: isSelected ? Colors.white : Colors.white70, size: 18),
        title: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.white70,
            fontSize: 15,
          ),
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
